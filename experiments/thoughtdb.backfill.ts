import vanjacloud from 'vanjacloud.shared.js'
import { ThoughtDB } from 'vanjacloud.shared.js'

export default async function backfill() {

    const db = new ThoughtDB(vanjacloud.Keys.notion, ThoughtDB.testdbid);

    db.getLatest
    console.log('backfill test...')
}