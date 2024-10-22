// generate user model class from following create table statement
// CREATE TABLE [dbo].[Users](
//     [Id] int IDENTITY(1,1) PRIMARY KEY,
//     [nickname] Text NOT NULL,
// 	[kindleAddress] Text NOT NUll,
// 	[notifyEmailAddress] Text NOT NULL,
//     [subscribedBooks] Text NOT NULL,
//     [TheEconomistCurrentVersion] int NOT NULL,
// );
// statement end


class User {
    id: number;
    nickname: string;
    kindleAddress: string;
    notifyEmailAddress: string;
    // split by |
    subscribedBooks: string;
    theEconomistCurrentVersion: number;

    constructor(id: number, nickname: string, kindleAddress: string, notifyEmailAddress: string, subscribedBooks: string, theEconomistCurrentVersion: number) {
        this.id = id;
        this.nickname = nickname;
        this.kindleAddress = kindleAddress;
        this.notifyEmailAddress = notifyEmailAddress;
        this.subscribedBooks = subscribedBooks;
        this.theEconomistCurrentVersion = theEconomistCurrentVersion;
    }

    // create new function to split subscribedBooks by | and the result need to be a set of string
    getSubscribedBooks(): Set<string> {
        return new Set(this.subscribedBooks.split('|'));
    }
}

export { User };