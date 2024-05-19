
import { main } from "./experiments/chat-therapist"
import dotenv from 'dotenv'

dotenv.config();

try {
    main();
} catch (e) {
    console.error(e);
}
