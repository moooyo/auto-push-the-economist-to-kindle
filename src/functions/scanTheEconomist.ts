import { app, InvocationContext, Timer } from "@azure/functions";
import { url } from "inspector";
import { JSDOM } from 'jsdom';
const pLimit = require('p-limit');

const limit = pLimit(10);

export async function scanTheEconomist(myTimer: Timer, context: InvocationContext): Promise<void> {
    context.log('Timer function processed request.');
    await doScanTheEconomist(context);
}

// generate book class, include the book title, displayTitle, book version and url, version need to be number type. And displayTitle need to be title_version pattern
class Book {
    title: string;
    displayTitle: string;
    version: number;
    url: string;

    constructor(title: string, version: number, url: string) {
        this.title = title;
        this.version = version;
        this.url = url;
        this.displayTitle = `${title}_${version}`;
    }
}


async function doScanTheEconomist(context: InvocationContext) {
    // Do the actual scanning here
    const targetUrl = "https://github.com/hehonghui/awesome-english-ebooks/tree/master/01_economist";

    // Do http get to fetch html from targetUrl
    const response = await fetch(targetUrl);
    const html = await response.text();

    // Parse html to get all the economist subfolder (class id = 'folder-row-0')
    const doc = new JSDOM(html).window.document;
    // query all item if class id match the pattern folder-row-number
    const economistFolders = doc.querySelectorAll('[id^=folder-row-]');
    const economistFolderAItems = Array.from(economistFolders).map(folder => folder.querySelector('a'));
    // exclude item if titles not start with te_ and get the href and convert to real url
    const economistFolderUrls = economistFolderAItems.filter(item => item.textContent.startsWith('te_')).map(item => new URL(item.href, targetUrl))
    //const economistFolderUrls = economistFolderAItems.filter(item => item.textContent.startsWith('te_')).map(item => item.href);

    // using context.log to log all economistFolderUrls, as following format 'href'
    economistFolderUrls.forEach(url => context.log(url));



    // open all of the economistFolderUrls and get html
    // using plimit to limit Promise.all to 2 concurrent fetches
    //const economistFolderHtmls = await Promise.all(economistFolderUrls.map(url => fetch(url).then(response => response.text())));
    const economistFolderHtmls = await Promise.all(economistFolderUrls.map(url => limit(() => fetch(url).then(response => response.text()))));

    // Get book url from economistFolderHtmls, it exist in a tag with title include epub and class include Link-Primary. The result need to be a object list which include the url link and the text for each a tag
    const economistBookUrls = economistFolderHtmls.map(html => {
        const doc = new JSDOM(html).window.document;
        const aTags = Array.from(doc.querySelectorAll('a'));
        return aTags.filter(a => a.title.includes('epub') && a.classList.contains('Link--primary')).map(a => ({ href: a.href, text: a.textContent, url: new URL(a.href, targetUrl) }));
    }).flat();

    context.log('Success to get the root folder page and parsed it.');
    // log all of the economistBookUrls, as following format 'text url'
    economistBookUrls.forEach(url => context.log(`text: ${url.text} url: ${url.url}`));
    context.log('ended');

    // open all of the economistBookUrls and get html. Save html to new object list. each object should include the html result and the textContent for each item of economistBookUrls
    // using plimit to limit Promise.all to 2 concurrent fetches
    //const economistBookRawHTMLs = await Promise.all(economistBookUrls.map(url => fetch(url.href).then(response => response.text().then(html => ({ html, text: url.text })))));
    const economistBookRawHTMLs = await Promise.all(economistBookUrls.map(url => limit(() => fetch(url.url).then(response => response.text().then(html => ({ html, text: url.text }))))));
    
    const economistBookRawLinks = economistBookRawHTMLs.map(html => {
        const doc = new JSDOM(html.html).window.document;
        const aTags = Array.from(doc.querySelectorAll('a'));
        return aTags.filter(a => a.querySelector('span')?.textContent === 'Raw').map(a => ({ href: a.href, text: html.text, url: new URL(a.href, targetUrl) }));
    }).flat();

    context.log('Success to get the book page and parsed it.');

    // construct book object from economistBookRawUrls. Title = the economist. text pattern = 'TheEconomist.YYYY.MM.DD.epub'. version = YYYYMMDD. url = href
    const regex = /\b(\d{4}\.\d{2}\.\d{2})\b/;
    const economistBooks = economistBookRawLinks.map(item => {
        const title = 'The Economist';
        const match = item.text.match(regex);
        const version = parseInt(match[1].split('.').join(''));
        const url = item.url;
        return new Book(title, version, url.toString());
    });

    context.log('Found the following Economist books:');

    // using context log all economistBooks. As the format 'title displayTitle version url'
    economistBooks.forEach(book => {
        context.log(`${book.title} ${book.displayTitle} ${book.version} ${book.url}`);
    });
}

app.timer('scanTheEconomist', {
    schedule: '0 * * */1 * *',
    runOnStartup: true,
    handler: scanTheEconomist
});
