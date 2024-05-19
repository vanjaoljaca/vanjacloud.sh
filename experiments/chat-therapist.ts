const config = {
    partition: {
        size: 300000
    },
    outputFolder: './output/gemini_pro',
    sourceFolder: '/Users/vanjaoljaca/Desktop/inspection/testlog'
}

export async function main() {
    const model = createModel();

    const allMessages = readFacebookMessages(config.sourceFolder);
    const initialContext = fs.readFileSync(path.join(config.sourceFolder, 'initial_context.md'), 'utf-8');

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
    Roleplay a therapist to analyze & comment on the interpersonal relationship dynamics in this chat log.
    Add quotes & explanations where necessary.
    Always try and quotelink to examples.
    Be aware that person A or person B may be a malicious / untrustworthy actor, in which case we have to give commentary and advice accounting for all possible scenarios(2x malicious, malicious & trustworthy, trustworthy & malicious, 2x trustworthy))
    Make sure to add a subheader that explains which date _RANGE_ was analyzed(first message date, last message date).
    Output should always be markdown formatted.
    Any feedback or advice should be given in a way that is actionable and clear, with accredited quotation including how it could have been phrased differently with example.
    Take note of any large gaps between message blocks(over a few months) and be aware that it means there was a disruption in the relationship.
    -----
            ${context}
        -----
    in this section I want you to focus on: ${subprompt}
        `,

    subprompts: [
        `comment on trust in the relationship and how it is progressing, and any discussions of it or conversational etiquete. 
        also comment as a therapist on who is acting in good faith(and who might not be), which things are breaking good faith and trust.with quotes.talk about progression over time and any conversational etiquete progression.
            specifically, i am interested in when trust builds or is broken(root cause analysis) so that periods of high / medium / low / no trust can be identified as a progression
        and that direct quotes can be made of what breaks / builds trust for learning purposes
            `,

        `collect a running tally on values & beliefs for each person.look for clashes and conflicts.also focus on contentious political scissor beliefs(eg trump, feminism, etc) and highlight stated beliefs, tracking as they change,
            but also evaluate what you think their actual beliefs are and if theyr ebeing honest.use this to think about impact on trust in the debates and discussions`,


        `the summary page of what happened in this block`,
        `the high level overview of all arguments, with therapist, debate judge, and objective ruling of content based on wikipedia- esque facts`,
        `play by play overview of arguments, highlighting the root cause of where they broke down and why`,
        `interpersonal dynamics, power, grwoth, change`,
        `analysis of likeliness of good faith vs bad faith and how to tell,`,
        `tips for each person and feedback`,
        `conversational etiquette tips`,


    ],

    generateContextSubprompt: `generate a context subprompt for the next session, including things to follow up and track on to follow up growth and change in dynamic`,

    verificationPrompt: `verify that the above is correct, paying special attention to make sure qoutes and attitudes are attributed to the correct person.make sure that power dynamics are not expressed backwards.
when finding errors, explain the errors in a DIFF format, i dont want a full rewrite.reference where the errors are exactly and what was wrong`,
    generateContextNextPrompt: (allPartitionSummaries, verificationResult) => {
        return `${prompts.generateContextSubprompt}

    Make sure to summarize anything relevant and output it so i can pass it back to you next session.
    The emphasis here is describing what has happened, and some of what to look for.Provide yourself context clues, dont just flood it with more instructions
    on what to look for in future.
    Also, all these chat logs have already happened, so you will not be able to give feedback directly to the people involved in the chat log.
    Below are all the notes you gave me so far.
    ----
    ${allPartitionSummaries}
----------------
    verification result: (apply this as a diff on above to fix errors)

    ${verificationResult}
`},
    generateFinalSummaryRequest: (initialContext, allSummaries) => {
        return `Now create a final report of all the following summaries from therapist report.
Take note of the time stamps and create a comprehensive full report of everything involved.
Make sure to structure it in a way that is easy to read and understand, and consume in a relatively enjoyable way.
 
I would expect you to also generate commentary about overarching themes and progress across time, that is key for this final step.
    I'm expecting to see commentary on the relationship dynamics over the whole narrative arc first, and then dive into individual areas of interest in the relationship in separate sections.

I would also expect it to wrap up the report in some reasonable way

---
----
    initialContext: ${initialContext}
----
    The following summaries were generated with these prompts:

Roleplay a therapist to analyze & comment on the interpersonal relationship dynamics in this chat log.
Add quotes & explanations where necessary.
Always try and quotelink to examples.
Be aware that person A or person B may be a malicious / untrustworthy actor, in which case we have to give commentary and advice accounting for all possible scenarios(2x malicious, malicious & trustworthy, trustworthy & malicious, 2x trustworthy))
Make sure to add a subheader that explains which date range was analyzed.

- ${prompts.subprompts.join('\n- ')}
- ${prompts.verificationPrompt}

----------------
    ${allSummaries.join('\n\n')}
`
    }
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