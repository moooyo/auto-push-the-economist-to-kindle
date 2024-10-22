import { app, InvocationContext, Timer } from "@azure/functions";
import { JSDOM } from 'jsdom';

require('dotenv').config();

import { Book } from '../models/book';
import { User } from "../models/user";
import { TheEconomist } from "../models/theEconomist";

const sql = require('mssql')
const pLimit = require('p-limit');

const { EmailClient, KnownEmailSendStatus } = require("@azure/communication-email");

const limit = pLimit(10);

export async function pushBooksToKindle(myTimer: Timer, context: InvocationContext): Promise<void> {
    context.log('Timer function processed request. Start to push books to Kindle.');
    await doPushBooksToKindle(context);
}

async function doPushBooksToKindle(context: InvocationContext) {
    // Do the actual scanning here

    // start to connect to the database
    await sql.connect(process.env.SqlConnectionString);
    context.log('Connected to the database.');

    // load all users from the database dbo.Users and parse to class User list
    const users = await sql.query`select * from dbo.Users`;
    const userList = Array.isArray(users.recordset) 
    ? await users.recordset.map(user => new User(user.Id, user.nickname, user.kindleAddress, user.notifyEmailAddress, user.subscribedBooks, user.theEconomistCurrentVersion))
    : [];

    context.log('Start to push books to Kindle. users: ' + JSON.stringify(userList));

    for (const user of userList) {
        context.log(`User: ${user.nickname}, subscribed books: ${user.subscribedBooks}`);
        // get the subscribed books from user
        const subscribedBooks = user.getSubscribedBooks();

        for (const book of subscribedBooks) {
            context.log(`Start to fetch book ${book} to ${user.nickname}'s kindle address: ${user.kindleAddress}`);
            const attachments = await doFetchBook(book, user, context);
            context.log(`Start to push book ${book} to ${user.nickname}'s kindle address: ${user.kindleAddress}`);
            await doPushBooksToKindleAndNotifyUser(user, book, attachments, context);
            context.log(`End pushed book ${book} to ${user.nickname}'s kindle address: ${user.kindleAddress}`);
        }
    }
}

// generate new book attachment class which include the book title, displayTitle, book version and bit array content
class BookAttachment {
    title: string;
    displayTitle: string;
    version: number;
    content: Buffer;

    constructor(title: string, version: number, content: Buffer, displayTitle: string) {
        this.title = title;
        this.version = version;
        this.content = content;
        this.displayTitle = displayTitle;
    }
}

async function doSendToKindleCallback(user: User, book:string , attachments: BookAttachment[], context: InvocationContext): Promise<boolean> {
    if (book === 'TheEconomist') {
        // update the user.theEconomistCurrentVersion to the largest version in the attachments
        const largestVersion = Math.max(...attachments.map(attachment => attachment.version));
        await sql.query`update dbo.Users set theEconomistCurrentVersion = ${largestVersion} where Id = ${user.id}`;
        return true;
    }

    return false;
}



async function doFetchTheEconomist(user: User, context: InvocationContext): Promise<BookAttachment[]> {
    // fetch the economist book which version is large than user.theEconomistCurrentVersion from dbo.TheEconomist and parse to class Book list. 
    // if user.theEconomistCurrentVersion == -1, just fetch the largest version one.
    // generate code
    context.log(`Start to fetch The Economist book for ${user.nickname} current version: ${user.theEconomistCurrentVersion} ${user.theEconomistCurrentVersion === -1}`);

    var bookList = [];
    if (user.theEconomistCurrentVersion === -1) {
        const books = await sql.query`select TOP 1 * from dbo.TheEconomist order by version desc`;
        // convert book to TheEconomist class list
        context.log(`book: ${JSON.stringify(books)}`);
        bookList = await books.recordset.map(book => new TheEconomist(book.Id, book.title, book.displayTitle, book.version, book.epubDownloadUrl));
        context.log(`bookList: ${JSON.stringify(bookList)}`);
    } else {
        const books = await sql.query`select * from dbo.TheEconomist where version > ${user.theEconomistCurrentVersion}`;
        bookList = await books.recordset.map(book => new TheEconomist(book.Id, book.title, book.displayTitle, book.version, book.epubDownloadUrl));
    }

    // BUG HERE
    context.log(`prepare to download ${bookList.length} books. books ${JSON.stringify(bookList)}`);

    // downloads all the books in the bookList from book.url and store the content in new BookAttachment list.
    // using plimit to limit Promise.all to 2 concurrent fetches
    const bookAttachments = await Promise.all(bookList.map(book => limit(() => fetch(book.epubDownloadUrl).then(response => response.arrayBuffer().then(content => Buffer.from(new Uint8Array(content))).then(content => new BookAttachment(book.title, book.version, content, book.displayTitle))))));

    return bookAttachments;
}

async function doFetchBook(bookName: string, user: User, context: InvocationContext): Promise<BookAttachment[]> {
    // create a function table, key is bookName and value is a function which will return the book attachment list
    const fetchBookFunctionTable = {
        'TheEconomist': doFetchTheEconomist
    };

    // call the function to fetch the book
    return await fetchBookFunctionTable[bookName](user, context);
}

async function doPushBooksToKindleAndNotifyUser(user: User, book:string, attachments: BookAttachment[], context: InvocationContext) {
    // load sendToKindleEmail from environment variable
    const sendToKindleEmail = process.env['SEND_TO_KINDLE_EMAIL'];
    const notifyEmailAddress = process.env['NOTIFY_USER_EMAIL'];
    
    const bookMessage = {
        senderAddress: sendToKindleEmail,
        recipients: {
            to: [{ address: user.kindleAddress }],
        },
        content: {
            subject: "attachment email",
            plainText: "This is plaintext body of test email.",
            html: "<html><h1>This is the html body of test email.</h1></html>",
        },
        // convert attachments to email attachment format
        attachments: await attachments.map(attachment => {
            return {
                name: `${attachment.displayTitle}.epub`,
                contentType: "application/epub+zip",
                contentInBase64: attachment.content.toString("base64"),
            }
        })
    }

    // log attachments number to context and log bookMessage attachments number to context
    context.log(`attachments number: ${attachments.length}`);
    context.log(`bookMessage attachments number: ${bookMessage.attachments.length}`);

    const sendtoKindleSuccess = await sendEmail(bookMessage, context);
    if (!sendtoKindleSuccess) {
        context.log(`Failed to send email to ${user.nickname}'s email. address: ${user.kindleAddress}`);
        return;
    }

    if (!await doSendToKindleCallback(user, book, attachments, context)) {
        context.log(`Failed to send callback to ${user.nickname}'s email. address: ${user.kindleAddress}`);
        return;
    }

    const notifyMessage = {
        senderAddress: notifyEmailAddress,
        recipients: {
            to: [{ address: user.notifyEmailAddress }],
        },
        content: {
            subject: "notify email",
            plainText: "This is plaintext body of test email.",
            html: "<html><h1>This is the html body of test email.</h1></html>",
        }
    }

    const notifyUserSuccess = await sendEmail(notifyMessage, context);
    if (!notifyUserSuccess) {
        context.log(`Failed to send notify email to ${user.nickname}'s email. address: ${user.notifyEmailAddress}`);
        return;
    }

    context.log(`Successfully sent email to ${user.nickname}'s kindle address: ${user.kindleAddress} and notify email address: ${user.notifyEmailAddress}`);
}

// create new function send email just split send part of function doPushBooksToKindleAndNotifyUser
async function sendEmail(message: object, context: InvocationContext): Promise<boolean> {
    const POLLER_WAIT_TIME = 10

    try {
        const connectionString = process.env['COMMUNICATION_SERVICES_CONNECTION_STRING'];
        const emailClient = new EmailClient(connectionString);
        context.log('Connected to the email client.');

        const poller = await emailClient.beginSend(message);

        if (!poller.getOperationState().isStarted) {
            throw "Poller was not started."
        }

        let timeElapsed = 0;
        while (!poller.isDone()) {
            poller.poll();
            context.log("Email send polling in progress");

            await new Promise(resolve => setTimeout(resolve, POLLER_WAIT_TIME * 1000));
            timeElapsed += 10;

            if (timeElapsed > 18 * POLLER_WAIT_TIME) {
                throw "Polling timed out.";
            }
        }

        if (poller.getResult().status === KnownEmailSendStatus.Succeeded) {
            context.log(`Successfully sent the email (operation id: ${poller.getResult().id})`);
        }
        else {
            throw poller.getResult().error;
        }
    } catch (e) {
        context.log(`send email error. Error: ${e}`);
        return false;
    }

    return true;
}

app.timer('pushBooksToKindle', {
    schedule: '0 * * */1 * *',
    runOnStartup: true,
    handler: pushBooksToKindle
});
