import { html } from "diff2html";
import ModuleConfigEnginePlugin from "main";
import { FileSystemAdapter, ItemView, WorkspaceLeaf } from "obsidian";
import { promisify } from "util";
import * as child_process from "child_process";

export const CONFIG_ALL_DIFF_VIEW_TYPE: string = 'config-all-diff-view';

const exec = promisify(child_process.exec);

export class ConfigAllDiffView extends ItemView {

	private plugin: ModuleConfigEnginePlugin;
	private gettingDiff = false;

	constructor(leaf: WorkspaceLeaf, plugin: ModuleConfigEnginePlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return CONFIG_ALL_DIFF_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Config Diff';
	}

	getIcon(): string {
		return 'git-pull-request';
	}

	async onOpen() {
		await this.refresh();
	}

	async onClose() {
	}

	getVaultPath(): string | null {
		let adapter = this.app.vault.adapter;
		if (adapter instanceof FileSystemAdapter) {
			return adapter.getBasePath();
		}
		return null;
	}

	async refresh() {
		if (this.gettingDiff) return;

		this.gettingDiff = true;
		this.contentEl.empty();
		this.contentEl.createEl('h2', { text: 'Configuration Diff' });

		try {
			const vaultPath = this.getVaultPath();
			const configPath = `${vaultPath}/.obsidian`;

			// Initialize Git repo if needed
			const isGitRepo = await this.isGitRepository(configPath);
			if (!isGitRepo) {
				await this.initializeGitRepo(configPath);
				this.contentEl.createEl('p', { text: 'Initialized Git repository for config' });
				return;
			}

			// Get diff
			const diff = await this.getGitDiff(configPath);

			if (!diff) {
				this.contentEl.createEl('p', { text: 'No configuration changes detected' });
				return;
			}

			// Render diff
			this.renderDiff(diff);

		} catch (error) {
			this.contentEl.createEl('p', {
				text: `Error: ${error.message || error}`,
				cls: 'config-diff-error'
			});
			console.error('Config Diff Error:', error);
		} finally {
			this.gettingDiff = false;
		}
	}

	private renderDiff(diff: string) {
		// Generate HTML from diff
		const diffHtml = html(diff, {
			drawFileList: true,
			outputFormat: 'side-by-side',
			matching: 'lines'
		});

		// Create container for diff
		const diffContainer = this.contentEl.createDiv('config-diff-container');
		diffContainer.innerHTML = diffHtml;
	}

	private async isGitRepository(path: string): Promise<boolean> {
		try {
			await exec('git rev-parse --is-inside-work-tree', { cwd: path });
			return true;
		} catch {
			return false;
		}
	}

	private async initializeGitRepo(path: string) {
		await exec('git init', { cwd: path });
		await exec('git add .', { cwd: path });
		await exec('git commit -m "Initial config commit"', { cwd: path });
	}

	private async getGitDiff(path: string): Promise<string> {
		try {
			const { stdout } = await exec('git diff HEAD', { cwd: path });
			return stdout;
		} catch (error) {
			if (error.stderr && error.stderr.includes('no changes added to commit')) {
				return '';
			}
			throw error;
		}
	}
}