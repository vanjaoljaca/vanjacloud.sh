import OpenAI from 'openai';
import {CompletionCreateParams} from "openai/resources/chat/completions";

// Initialize the OpenAI API with your API key
const openai = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY'],
});

const MODEL_NAME = 'gpt-3.5-turbo-0613';

async function main() {
    // The initial conversation with the model
    const messages : Array<CompletionCreateParams.CreateChatCompletionRequestNonStreaming.Messages> = [
            {
                role: 'system',
                content: 'You are a helpful assistant.'
            },
            {
                role: 'user',
                content: 'What is 2 squared'
            }
        ];

    let functions = [
        {
            name: 'square',
            description: 'square the given number',
            parameters: {
                type: 'object',
                properties: {
                    x: {
                        type: 'integer',
                        description: 'The number to be squared'
                    }
                }
            }
        }
    ];
    let response = await openai.chat.completions.create({
        model: MODEL_NAME,
        messages: messages,
        function_call: {name: 'square'},
        functions: functions
    });

    console.log(response)
    console.log(JSON.stringify(response.choices, null, 2))

    // Check if the model made a function call
    if (true || response.choices[0].finish_reason === 'function_call') {
        // Get the function call details
        const functionCall = response.choices[0].message.function_call;

        const args = JSON.parse(functionCall.arguments);
        // Perform the function and get the result
        const functionResult = args.x * args.x;

        messages.push(response.choices[0].message)
        messages.push(
            {
                "role": "function",
                "name": functionCall.name,
                "content": functionResult.toString(),
            }
        )

        // Send the result back to the model
        response = await openai.chat.completions.create({
            model: MODEL_NAME,
            messages: messages,
            functions: functions
        });

        console.log(response)
        console.log(JSON.stringify(response.choices, null, 2))
    }
}

main().catch(console.error);
