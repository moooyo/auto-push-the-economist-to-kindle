// generate the economist class from following SQL statement
// CREATE TABLE [dbo].[TheEconomist](
//     [Id] int IDENTITY(1,1) PRIMARY KEY,
//     [title] Text NOT NULL,
// 	[displayTitle] Text NOT NUll,
// 	[version] int NOT NULL UNIQUE,
//     [epubDownloadUrl] text NOT NULL,
// );
// statement end. start generate the economist class
//
export class TheEconomist {
    id: number;
    title: string;
    displayTitle: string;
    version: number;
    epubDownloadUrl: string;

    constructor(id:number, title: string, displayTitle: string, version: number, epubDownloadUrl: string) {
        this.id = id;
        this.title = title;
        this.displayTitle = displayTitle;
        this.version = version;
        this.epubDownloadUrl = epubDownloadUrl;
    }
}
