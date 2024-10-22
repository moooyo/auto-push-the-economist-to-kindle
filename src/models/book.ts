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

// export book
export { Book };