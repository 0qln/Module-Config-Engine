export class ConfigModule {
    name: string;
    
    // returns the name of the repository.
    repositoryName(): string {
        return `${this.name}.obsidian`;
    }
    
    // returns the path of the repository relative to the vault root.
    repositoryPath(): string {
        return `.obsidian/${this.repositoryName()}`;
    }
    
    // returns the path to the patches.
    patchesPath(): string {
        return `${this.repositoryPath()}/src`;
    }
    
    constructor(name: string) {
        this.name = name;
    }
    
    initRepository(): boolean {
    }
}