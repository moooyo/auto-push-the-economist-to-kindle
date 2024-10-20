CREATE TABLE [dbo].[TheEconomist](
    [Id] int IDENTITY(1,1) PRIMARY KEY,
    [title] Text NOT NULL,
	[displayTitle] Text NOT NUll,
	[version] int NOT NULL UNIQUE,
    [epubDownloadUrl] text NOT NULL,
);

DROP Table [dbo].[TheEconomist];