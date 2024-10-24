CREATE TABLE [dbo].[TheEconomist](
    [Id] int IDENTITY(1,1) PRIMARY KEY,
    [title] Text NOT NULL,
	[displayTitle] Text NOT NUll,
	[version] int NOT NULL UNIQUE,
    [epubDownloadUrl] text NOT NULL,
);

CREATE TABLE [dbo].[Users](
    [Id] int IDENTITY(1,1) PRIMARY KEY,
    [nickname] Text NOT NULL,
	[kindleAddress] Text NOT NUll,
	[notifyEmailAddress] Text NOT NULL,
    [subscribedBooks] Text NOT NULL,
    [TheEconomistCurrentVersion] int NOT NULL,
);

DROP Table [dbo].[TheEconomist];