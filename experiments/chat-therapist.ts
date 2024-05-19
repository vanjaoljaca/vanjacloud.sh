const config = {
    partition: {
        size: 300000
    },
    outputFolder: './output/gemini_pro',
    sourceFolder: '/Users/vanjaoljaca/Desktop/inspection/testlog',
    initialContextFile: 'initial_context.md'
}

export async function main() {
    const model = createModel();

    const allMessages = readFacebookMessages(config.sourceFolder);
    const initialContext = fs.readFileSync(path.join(config.sourceFolder, config.initialContextFile), 'utf-8');

    const partitions = await createPartitions(allMessages,
        async (t: string) => t.length * 2, //(await model.countTokens(t)).totalTokens,
        // async (t) => encode(t).length,
        config.partition.size); // 400000);

    console.log('Processing', partitions.length)

    var allSummaries = []
    var rollingContext = initialContext;

    for (let i = 0; i < partitions.length; i++) {

        const chat = model.startChat({
            history: [],
        });

        console.log(`Partition ${i} `);
        const partition = partitions[i]; // todo: big picture how to find objectionable content?
        var partitionText = partition.map(toString)
            // .map((v, i) => `${ i } ${ v } `) // add line number
            .join('\n');

        partitionText = customPartitionCleanUp(i, partitionText);

        fs.writeFileSync(path.join(config.outputFolder, `partition-${i}_chat.md`), partitionText)

        const partitionResponses = [] as any;

        for (let j = 0; j < prompts.subprompts.length; j++) {

            console.log(`- Subprompt ${j} `);
            const subprompt = prompts.subprompts[j];

            const msg = `${prompts.rollupPrompt(rollingContext, subprompt)} \n\n${partitionText} `;

            try {
                const responseText = await sendMessage(`partition-${i}_output-${j}`, chat, msg);
                partitionResponses.push(responseText);
            } catch (e) {
                if (e instanceof BlockedContentError) {
                    console.error('Blocked content', e);
                    return await tryFindWhatIsBlocked(model, partitionText,
                        t => `${prompts.rollupPrompt(rollingContext, subprompt)} \n\n${t} `
                    );
                }
            }
        }

        console.log('- Verification')
        const verificationResult = await sendMessage(`partition-${i}_verification`, chat, prompts.verificationPrompt); // it is missing the text sometimes...

        allSummaries = allSummaries.concat([...partitionResponses, verificationResult]);

        console.log('- Next context')
        // eh just rename this to i+1_context
        rollingContext = await sendMessage(`partition-${i}_context-next`, chat, prompts.generateContextNextPrompt(partitionResponses, verificationResult));
    }

    console.log('Final Summary')
    const finalSummary = await sendMessage('final_summary', model.startChat({ history: [] }),
        prompts.generateFinalSummaryRequest(initialContext, allSummaries)
    );
}

class BlockedContentError {
    constructor(e: any) {
        return 'e.response.promptFeedback.blockReason';
    }
}

async function sendMessage(name, chat, msg) {
    console.log('sendMessage', name)

    fs.writeFileSync(path.join(config.outputFolder, `request_${name}.md`), msg)
    const filename = `${name}.md`

    const override = customSendMessageOverride(name, chat, msg);
    if (override) {
        fs.writeFileSync(path.join(config.outputFolder, filename), override);
        return override;
    }

    while (true) {
        try {

            if (fs.existsSync(path.join(config.outputFolder, filename))) {
                return fs.readFileSync(path.join(config.outputFolder, filename), 'utf-8');
            }

            const result = await chat.sendMessage(msg);
            const response = await result.response
            const responseText = response.text();

            fs.writeFileSync(path.join(config.outputFolder, filename), responseText);

            return responseText;
        } catch (e) {

            if (e.status === 429) {
                const backoffTime = 60000;
                console.log(`${new Date()} Too many requests.Sleeping ${backoffTime} `)
                await new Promise(resolve => setTimeout(resolve, backoffTime));
                continue;
            } else if (e.response?.promptFeedback?.blockReason) {
                console.error(JSON.stringify(e, null, 2));
                throw new BlockedContentError(e);
            }

            throw e;
        }
    }
}


const getName = (name: string) => name.split(' ')[0];
const getDate = (msg: IFacebookMessage) => moment(msg.timestamp_ms).format('YYYY-MM-DD');
const toString = (msg: IFacebookMessage) => `[${getDate(msg)}]${getName(msg.sender_name)}: ${msg.content} `;


async function createPartitions(allMessages: IFacebookMessage[], countTokens: (m: string) => Promise<number>, maxTokens: number): Promise<IFacebookMessage[][]> {
    // todo: treat all busy day runs as one day, only take the full run if it fits in the chunk
    // todo: long gaps = forced partition
    const maxChunkSize = maxTokens;
    const minChunkSize = maxChunkSize * 0.95;



    const histogram = allMessages.reduce((acc, msg) => {
        const date = getDate(msg);
        acc[date] = acc[date] ? acc[date] + 1 : 1;
        return acc;
    }, {} as { [key: string]: number });

    const messageCounts = Object.values(histogram);
    const threshold = messageCounts.sort((a, b) => b - a)[Math.floor(messageCounts.length * 0.3)]; // top 30% of days

    let currentChunk: IFacebookMessage[] = [];
    let currentChunkSize = 0;
    let lastDate = getDate(allMessages[0]);
    const allMessageTokenCounts = await Promise.all(allMessages.map(m => countTokens(toString(m))));

    const partitions = allMessages.reduce((chunks: IFacebookMessage[][], message: IFacebookMessage, index: number) => {
        const messageSize = allMessageTokenCounts[index];
        const messageDate = getDate(message);

        const isBusyDay = histogram[messageDate] >= threshold;
        const nextMessage = allMessages[index + 1];
        const nextDate = nextMessage ? getDate(nextMessage) : null;
        const isNextDayBusy = nextDate ? histogram[nextDate] >= threshold : false; // todo backtracking

        if (
            (currentChunkSize + messageSize > maxChunkSize) ||
            (histogram[messageDate] === 0 && messageDate !== lastDate && currentChunkSize >= minChunkSize) ||
            (!isBusyDay && !isNextDayBusy && currentChunkSize >= minChunkSize)
        ) {
            chunks.push([...currentChunk]);
            currentChunk = [];
            currentChunkSize = 0;
        }

        currentChunk.push(message);
        currentChunkSize += messageSize;
        lastDate = messageDate;
        return chunks;
    }, []);

    if (currentChunk.length > 0) {
        partitions.push(currentChunk);
    }

    return partitions;
}

import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { encode } from 'gpt-3-encoder';

import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { HarmBlockThreshold, HarmCategory } from "@google/generative-ai";
import moment from 'moment';
import { exit } from 'process';
import { as } from 'ix/iterable';

const HarmCategories = [
    HarmCategory.HARM_CATEGORY_HARASSMENT,
    HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT
];

const exec = promisify(execCb);

interface IFacebookMessage {
    sender_name: string, timestamp_ms: number, content: string, is_geoblocked_for_viewer: boolean;
}

interface IFacebookMessagesFile {
    participants: { name: string }[];
    messages: IFacebookMessage[];
    title: string;
    is_still_participant: boolean;
    thread_path: string;
    magic_words: string[];
}

async function tryFindWhatIsBlocked(model, partitionText: string, gen = (t: string) => t) {
    const chat = model.startChat({
        history: [],
    });

    // reverse merge sort search / binary search range for the blocked content
    // todo: make this work, also split by line not by text chunk
    const searchStart = 0;
    const searchEnd = partitionText.length;
    const searchLength = searchEnd - searchStart;
    const slices = 5;
    const sliceSize = Math.floor(searchLength / slices);

    console.log('Searching', { searchStart, searchEnd, searchLength, sliceSize, slices })
    for (let i = 0; i < slices; i++) {
        const start = searchStart + sliceSize * i;
        const end = start + sliceSize;

        const testText = gen(partitionText.slice(start, end));
        try {
            console.log('Testing', { i, start, end });
            await sendMessage(`blocktest-${i}`, chat, testText);
        } catch (e) {
            console.log('Blocked content found', { start, end, e });
            exit(1);
            throw 'die'
        }
    }
    console.log('Not found')
    throw 'not found'
}

function createModel() {
    const safetySettings = HarmCategories.map(hc => ({
        category: hc,
        threshold: HarmBlockThreshold.BLOCK_NONE,
    }));
    const configuration = new GoogleGenerativeAI(process.env.GEMINI_KEY);
    const modelId = "gemini-1.5-pro-latest";
    const model = configuration.getGenerativeModel({ model: modelId, safetySettings });
    return model;
}

function readFacebookMessages(sourceFolder) {
    const files = fs.readdirSync(sourceFolder)
        .filter(f => f.endsWith('.json'));

    const allMessages = files.map(file => fs.readFileSync(path.join(sourceFolder, file), 'utf-8'))
        .map(file => JSON.parse(file) as IFacebookMessagesFile)
        .flatMap(file => file.messages)
        .sort((a, b) => a.timestamp_ms - b.timestamp_ms);

    return allMessages;
}

const prompts = {
    rollupPrompt: (context: string, subprompt: string) => `
    As a therapist, analyze and comment on the interpersonal relationship dynamics in this chat log.
    Include relevant quotes and explanations, and always link to examples.
    Be aware that either Person A or Person B may be a malicious or untrustworthy actor. Provide commentary and advice accounting for all possible scenarios (both malicious, one malicious and one trustworthy, both trustworthy).
    Add a subheader with the date range analyzed (first message date, last message date).
    Output should be in markdown format.
    Give actionable and clear feedback with accredited quotations, including how things could have been phrased differently with examples.
    Note any large gaps between message blocks (over a few months) indicating a disruption in the relationship.
    Pay attention to emotional tones, conflict escalation, resolution attempts, and significant turning points in the conversation.
    -----
    ${context}
    -----
    Focus on: ${subprompt}
    `,

    subprompts: [
        `Comment on the progression of trust in the relationship. Discuss any conversations on trust or conversational etiquette. Identify who is acting in good faith and who might not be, providing quotes. Analyze the progression of trust over time, identifying high, medium, low, or no trust periods, with direct quotes illustrating what builds or breaks trust.`,

        `Collect a running tally of values and beliefs for each person. Highlight clashes and conflicts, especially contentious political beliefs (e.g., Trump, feminism). Track stated beliefs, note changes, and evaluate honesty. Analyze the impact on trust in debates and discussions.`,

        `Provide a summary of what happened in this block, focusing on key events and dynamics.`,

        `Offer a high-level overview of all arguments, with an analysis from a therapist's perspective. Include a debate judge's ruling and objective assessment based on factual content.`,

        `Give a play-by-play overview of arguments, highlighting the root causes of breakdowns and reasons for conflicts.`,

        `Analyze interpersonal dynamics, including power struggles, growth, and change over time.`,

        `Assess the likelihood of good faith vs. bad faith actions and how to differentiate between them.`,

        `Provide personalized tips and feedback for each person involved, focusing on improving communication and resolving conflicts.`,

        `Suggest conversational etiquette improvements to enhance the quality of interactions and reduce misunderstandings.`,
    ],

    generateContextSubprompt: `Generate a context subprompt for the next session, including follow-up items to track growth and changes in dynamics. Focus on unresolved issues, recurring themes, and potential areas of improvement.`,

    verificationPrompt: `Verify that the above analysis is correct, ensuring quotes and attitudes are accurately attributed. Make sure power dynamics are correctly represented. Identify and explain errors in a DIFF format, referencing where the errors are exactly and what was wrong.`,

    generateContextNextPrompt: (allPartitionSummaries, verificationResult) => `
    ${prompts.generateContextSubprompt}

    Summarize anything relevant for the next session. Describe what has happened and provide context clues without overloading with instructions.
    Note that all these chat logs have already happened, so you cannot give direct feedback to the people involved.
    Below are all the notes so far.
    ----
    ${allPartitionSummaries}
    ----
    Verification result: (apply this as a diff to fix errors)
    ${verificationResult}
    `,

    generateFinalSummaryRequest: (initialContext, allSummaries) => `
    Create a final report from the following therapist summaries.
    Note the timestamps and create a comprehensive, structured, and engaging report.
    Provide commentary on overarching themes and progress over time.
    Start with relationship dynamics over the whole narrative arc, then dive into individual areas of interest in separate sections.
    Wrap up the report in a meaningful way.
    ----
    Initial Context: ${initialContext}
    ----
    The following summaries were generated with these prompts:
    - ${prompts.subprompts.join('\n- ')}
    - ${prompts.verificationPrompt}
    ----
    ${allSummaries.join('\n\n')}
    `
}

function customPartitionCleanUp(i, partitionText) {

    if (i === 41) {
        // political stuff?
        return partitionText.slice(10000, partitionText.length - 10000);
    }

    if (i === 53) {
        // not needed anymore?
        partitionText = partitionText.slice(0, partitionText.length - 20000);
    }

    return partitionText;
}

function customSendMessageOverride(name, chat, msg) {
    // if (name === 'partition-53_output-1') {
    //     // too tired to debug this again
    //     return '(analysis failed)';
    // }
    return undefined;
}