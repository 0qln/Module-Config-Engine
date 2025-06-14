import * as path from "path";
import * as fs from "fs";
import * as git from "isomorphic-git";

export class ConfigModule {
    name: string;
    
    // returns the name of the repository.
    repositoryName(): string {
        return `${this.name}.obsidian`;
    }
    
    // returns the path of the repository relative to the vault root.
    repositoryPath(): string {
        return path.join(".obsidian", this.repositoryName());
    }
    
    // returns the path to the patches.
    patchesPath(): string {
        return path.join(this.repositoryPath(), "src");
    }
    
    constructor(name: string) {
        this.name = name;
    }
    
    async initRepository(): Promise<void> {
        if (!fs.existsSync(this.repositoryPath())) {
            fs.mkdirSync(this.repositoryPath(), { recursive: true });
        }
        
        if (!(await git.currentBranch({ 
            fs: fs, 
            dir: this.repositoryPath() 
        }))) {
            await git.init({ 
                fs: fs, 
                dir: this.repositoryPath(), 
                defaultBranch: 'main' 
            });
            
            // Create src directory for patches
            fs.mkdirSync(this.patchesPath(), { recursive: true });
            
            // Initial commit
            await this.commitChanges("Initial commit");
        }
    }
}