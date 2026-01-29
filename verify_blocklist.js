import dotenv from 'dotenv';
dotenv.config();

const isEmailBlocked = (email) => {
    if (!email) return false;
    const blockedString = process.env.BLOCKED_EMAILS || '';
    console.log('Blocked String in Env:', blockedString);
    const blockedList = blockedString.split(',').map(e => e.trim().toLowerCase());
    console.log('Processed Blocklist:', blockedList);
    const result = blockedList.includes(email.toLowerCase());
    console.log(`Checking ${email}: ${result ? 'BLOCKED' : 'ALLOWED'}`);
    return result;
};

const testEmail = 'geert.schepers@gmail.com';
isEmailBlocked(testEmail);
