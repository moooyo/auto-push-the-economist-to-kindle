import { app, InvocationContext, Timer } from "@azure/functions";

export async function scanTheEconomist(myTimer: Timer, context: InvocationContext): Promise<void> {
    context.log('Timer function processed request.');
    doScanTheEconomist(context);
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
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    // query all item if class id match the pattern folder-row-number
    const economistFolders = doc.querySelectorAll('[id^=folder-row-]');
    const economistFolderAItems = Array.from(economistFolders).map(folder => folder.querySelector('a'));
    // exclude item if titles not start with te_ and get the href
    const economistFolderUrls = economistFolderAItems.filter(item => item.textContent.startsWith('te_')).map(item => item.href);

    // open all of the economistFolderUrls and get html
    const economistFolderHtmls = await Promise.all(economistFolderUrls.map(url => fetch(url).then(response => response.text())));

    // Get book url from economistFolderHtmls, it exist in a tag with title include epub. The result need to be a object list which include the href link and the text for each a tag
    const economistBookUrls = economistFolderHtmls.map(html => {
        const doc = parser.parseFromString(html, 'text/html');
        const aTags = Array.from(doc.querySelectorAll('a'));
        return aTags.filter(a => a.title.includes('epub')).map(a => ({ href: a.href, text: a.textContent }));
    }).flat();

    // open all of the economistBookUrls and get html. Save html to new object list. each object should include the html result and the textContent for each item of economistBookUrls
    const economistBookRawHTMLs = await Promise.all(economistBookUrls.map(url => fetch(url.href).then(response => response.text().then(html => ({ html, text: url.text })))));

    
    const economistBookRawLinks = economistBookRawHTMLs.map(html => {
        const doc = parser.parseFromString(html.html, 'text/html');
        const aTags = Array.from(doc.querySelectorAll('a'));
        return aTags.filter(a => a.querySelector('span')?.textContent === 'Raw').map(a => ({ href: a.href, text: html.text }));
    }).flat();

    // construct book object from economistBookRawUrls. Title = the economist. text pattern = 'te_YYYY.MM.DD'. version = YYYYMMDD. url = href
    const economistBooks = economistBookRawLinks.map(item => {
        const title = 'The Economist';
        const version = parseInt(item.text.split('_')[1].replace(/\./g, ''));
        const url = item.href;
        return new Book(title, version, url);
    });

    // using context log all economistBooks
    economistBooks.forEach(book => context.log(book));
}

app.timer('scanTheEconomist', {
    schedule: '0 * */1 * * *',
    handler: scanTheEconomist
});
