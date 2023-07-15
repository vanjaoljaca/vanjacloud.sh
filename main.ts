import OpenAI from 'openai';
import { CompletionCreateParams } from "openai/resources/chat/completions";

import dotenv from 'dotenv';
dotenv.config();

// Initialize the OpenAI API with your API key
const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

const MODEL_NAME = 'gpt-3.5-turbo-0613';

async function main() {
    // The initial conversation with the model
    const messages: Array<CompletionCreateParams.CreateChatCompletionRequestNonStreaming.Messages> = [
        {
            role: 'system',
            content: 'You are an AI software developer with file system access. Think step by step. Make a plan for how to build the request. Then output the files.'
        },
        {
            role: 'user',
            content: 'Build a shell app that squares a number'
        }
    ];

    let functions = [
        {
            name: 'save',
            description: 'saves a file to disk',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'The name of file to save'
                    },
                    contents: {
                        type: 'string',
                        description: 'the file contents to save'
                    }
                }
            }
        }
    ];
    let response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        function_call: { name: functions[0].name },
        functions: functions
    });

    console.log(response)
    console.log(JSON.stringify(response.choices, null, 2))

    // Check if the model made a function call
    if (response.choices[0].finish_reason === 'function_call') {
        // Get the function call details
        const functionCall = response.choices[0].message.function_call;

        let functionResult;
        try {
            const args = JSON.parse(functionCall.arguments);
            // Perform the function and get the result
            // Example implementation: Save the file
            functionResult = saveFile(args.name, args.contents);
        } catch (error) {
            functionResult = 'Error: Invalid arguments';
        }

        messages.push(response.choices[0].message);
        messages.push(
            {
                "role": "function",
                "name": functionCall.name,
                "content": functionResult.toString(),
            }
        );

        // Send the result back to the model
        response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages,
            functions: functions
        });

        console.log(response);
        console.log(JSON.stringify(response.choices, null, 2));
    }
}

function saveFile(name: string, contents: string): string {
    // Example implementation: Save the file
    // Replace this with your actual file-saving logic
    // Return the appropriate result based on the success or failure of the operation
    return 'Saved.';
}

main().catch(console.error);
