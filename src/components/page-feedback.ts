/**
 * Behaviour for the "Was this page helpful?" footer widget.
 *
 * Yes -> record the vote, then offer to share the page.
 * No  -> record the vote, then ask what went wrong.
 *
 * The vote is sent the moment it is clicked, so abandoning the dialog still
 * leaves the signal behind. Written comments are attached to that same vote
 * server-side rather than stored as a second one.
 *
 * Deliberately dependency-free: this runs on every page of the site, so it is
 * not worth pulling a rendering library into the shared bundle.
 */

const ENDPOINT = '/api/feedback';
const STORAGE_PREFIX = 'opd:feedback:';
const MAX_COMMENT_LENGTH = 2000;

const REASONS = [
	{ value: 'inaccurate', label: 'Inaccurate' },
	{ value: 'outdated', label: 'Out of date' },
	{ value: 'confusing', label: 'Hard to follow' },
	{ value: 'incomplete', label: 'Not detailed enough' },
	{ value: 'missing', label: "Didn't cover my case" },
	{ value: 'broken', label: 'Broken link or example' },
	{ value: 'other', label: 'Something else' },
];

interface ShareTarget {
	label: string;
	icon: string;
	href: (url: string, title: string) => string;
}

const SHARE_TARGETS: ShareTarget[] = [
	{
		label: 'X',
		icon: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z',
		href: (url, title) => `https://x.com/intent/post?text=${enc(title)}&url=${enc(url)}`,
	},
	{
		label: 'Bluesky',
		icon: 'M12 10.8c-1.087-2.114-4.046-6.053-6.798-7.995C2.566.944 1.561 1.266.902 1.565.139 1.908 0 3.08 0 3.768c0 .69.378 5.65.624 6.479.815 2.736 3.713 3.66 6.383 3.364-3.912.58-7.387 2.005-2.83 7.078 5.013 5.19 6.87-1.113 7.823-4.308.953 3.195 2.05 9.271 7.733 4.308 4.267-4.308 1.172-6.498-2.74-7.078 2.67.296 5.568-.628 6.383-3.364.246-.828.624-5.789.624-6.479 0-.688-.139-1.86-.902-2.203-.659-.299-1.664-.621-4.3 1.24C16.046 4.747 13.087 8.686 12 10.8z',
		href: (url, title) => `https://bsky.app/intent/compose?text=${enc(`${title} ${url}`)}`,
	},
	{
		label: 'LinkedIn',
		icon: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 1 1 0-4.125 2.062 2.062 0 0 1 0 4.125zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
		href: (url) => `https://www.linkedin.com/sharing/share-offsite/?url=${enc(url)}`,
	},
	{
		label: 'Reddit',
		icon: 'M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12.5c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z',
		href: (url, title) => `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(title)}`,
	},
	{
		label: 'Hacker News',
		icon: 'M0 24V0h24v24H0zM6.951 5.896l4.112 7.708v5.064h1.583v-4.972l4.148-7.799h-1.749l-2.457 4.875c-.372.745-.688 1.434-.688 1.434s-.297-.708-.651-1.434L8.831 5.896h-1.88z',
		href: (url, title) => `https://news.ycombinator.com/submitlink?u=${enc(url)}&t=${enc(title)}`,
	},
	{
		label: 'Telegram',
		icon: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
		href: (url, title) => `https://t.me/share/url?url=${enc(url)}&text=${enc(title)}`,
	},
	{
		label: 'Email',
		icon: 'M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z',
		href: (url, title) => `mailto:?subject=${enc(title)}&body=${enc(`${title}\n\n${url}`)}`,
	},
];

const COPY_ICON =
	'M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z';

function enc(value: string): string {
	return encodeURIComponent(value);
}

function currentPage(): string {
	const path = window.location.pathname;
	return path.length > 1 && !path.endsWith('/') ? `${path}/` : path;
}

function storageKey(): string {
	return `${STORAGE_PREFIX}${currentPage()}`;
}

function readStoredVote(): string | null {
	try {
		return window.localStorage.getItem(storageKey());
	} catch {
		return null;
	}
}

function storeVote(vote: 'yes' | 'no'): void {
	try {
		window.localStorage.setItem(storageKey(), vote);
	} catch {
		// Private mode or storage disabled: the vote is still recorded server-side.
	}
}

interface Submission {
	helpful: boolean;
	reason?: string;
	comment?: string;
	email?: string;
	website?: string;
	elapsed?: number;
}

async function submit(body: Submission): Promise<boolean> {
	try {
		const response = await fetch(ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ page: currentPage(), ...body }),
		});
		return response.ok;
	} catch {
		return false;
	}
}

function icon(path: string, size = 20): string {
	return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true"><path d="${path}"></path></svg>`;
}

/** Native <dialog> so focus trapping, Escape and the backdrop come for free. */
function openDialog(className: string, contents: string): HTMLDialogElement {
	const dialog = document.createElement('dialog');
	dialog.className = `feedback-dialog ${className}`;
	dialog.innerHTML = contents;
	document.body.appendChild(dialog);

	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	dialog.addEventListener('close', () => dialog.remove());
	dialog.showModal();

	return dialog;
}

function shareDialog(): void {
	// Origin + path only: a crafted query or fragment should not ride along into
	// somebody's timeline.
	const { origin, pathname } = window.location;
	const url = `${origin}${pathname}`;
	const heading = document.querySelector('h1')?.textContent?.trim();
	const title = heading ? `${heading} — OpenPlanetData` : 'OpenPlanetData — open datasets about our planet';

	const dialog = openDialog(
		'feedback-dialog-share',
		`
		<h2 class="feedback-dialog-title">Glad it helped</h2>
		<p class="feedback-dialog-text">
			OpenPlanetData is free, open, and has no ads or API keys. Telling someone
			about it is the most useful thing you can do for it.
		</p>
		<div class="feedback-share-grid">
			<button type="button" class="feedback-share-link" data-copy>
				${icon(COPY_ICON)}<span>Copy link</span>
			</button>
		</div>
		<div class="feedback-dialog-actions">
			<button type="button" class="feedback-btn feedback-btn-ghost" data-close>No thanks</button>
		</div>`,
	);

	// Built through the DOM rather than interpolated into markup, so the page
	// title and URL can never be parsed as HTML.
	const grid = dialog.querySelector('.feedback-share-grid')!;
	for (const target of SHARE_TARGETS) {
		const link = document.createElement('a');
		link.className = 'feedback-share-link';
		link.href = target.href(url, title);
		link.target = '_blank';
		link.rel = 'noopener noreferrer';
		link.innerHTML = icon(target.icon);

		const label = document.createElement('span');
		label.textContent = target.label;
		link.appendChild(label);

		grid.insertBefore(link, grid.lastElementChild);
	}

	const copyButton = dialog.querySelector<HTMLButtonElement>('[data-copy]');
	copyButton?.addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(url);
			const label = copyButton.querySelector('span');
			if (label) {
				label.textContent = 'Copied';
				window.setTimeout(() => {
					label.textContent = 'Copy link';
				}, 1500);
			}
		} catch {
			// Clipboard blocked; the address bar still has the URL.
		}
	});

	dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
}

function commentDialog(): void {
	const openedAt = Date.now();

	const options = REASONS.map(
		(reason) => `<option value="${reason.value}">${reason.label}</option>`,
	).join('');

	const dialog = openDialog(
		'feedback-dialog-comment',
		`
		<form method="dialog" class="feedback-form">
			<h2 class="feedback-dialog-title">Sorry this page missed the mark</h2>
			<p class="feedback-dialog-text">
				Tell us what went wrong and it goes straight to the people who maintain
				this page. Every note is read.
			</p>

			<label class="feedback-field">
				<span class="feedback-field-label">What was the problem?</span>
				<select name="reason" class="feedback-select">
					<option value="">Pick one…</option>
					${options}
				</select>
			</label>

			<label class="feedback-field">
				<span class="feedback-field-label">What would have helped?</span>
				<textarea name="comment" class="feedback-textarea" rows="5"
					maxlength="${MAX_COMMENT_LENGTH}"
					placeholder="The rclone example fails because…"></textarea>
				<span class="feedback-counter" data-counter>0 / ${MAX_COMMENT_LENGTH}</span>
			</label>

			<label class="feedback-field">
				<span class="feedback-field-label">Email <span class="feedback-optional">optional, only if you want a reply</span></span>
				<input type="email" name="email" class="feedback-input" autocomplete="email" placeholder="you@example.com" />
			</label>

			<div class="feedback-honeypot" aria-hidden="true">
				<label>Website<input type="text" name="website" tabindex="-1" autocomplete="off" /></label>
			</div>

			<p class="feedback-status" data-status role="status"></p>

			<div class="feedback-dialog-actions">
				<button type="button" class="feedback-btn feedback-btn-ghost" data-close>Cancel</button>
				<button type="submit" class="feedback-btn feedback-btn-primary" data-submit>Send feedback</button>
			</div>
		</form>`,
	);

	const form = dialog.querySelector('form')!;
	const textarea = form.querySelector<HTMLTextAreaElement>('[name="comment"]')!;
	const counter = form.querySelector<HTMLElement>('[data-counter]')!;
	const status = form.querySelector<HTMLElement>('[data-status]')!;
	const submitButton = form.querySelector<HTMLButtonElement>('[data-submit]')!;

	textarea.addEventListener('input', () => {
		counter.textContent = `${textarea.value.length} / ${MAX_COMMENT_LENGTH}`;
	});

	dialog.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());

	form.addEventListener('submit', async (event) => {
		// The dialog would otherwise close on submit before the request is sent.
		event.preventDefault();

		const comment = textarea.value.trim();
		if (!comment) {
			status.textContent = 'Please add a short note so we know what to fix.';
			status.dataset.tone = 'error';
			textarea.focus();
			return;
		}

		submitButton.disabled = true;
		submitButton.textContent = 'Sending…';

		const data = new FormData(form);
		const ok = await submit({
			helpful: false,
			reason: String(data.get('reason') ?? '') || undefined,
			comment,
			email: String(data.get('email') ?? '') || undefined,
			website: String(data.get('website') ?? ''),
			elapsed: Date.now() - openedAt,
		});

		if (!ok) {
			status.textContent = 'That did not go through. Please try again in a moment.';
			status.dataset.tone = 'error';
			submitButton.disabled = false;
			submitButton.textContent = 'Send feedback';
			return;
		}

		form.innerHTML = `
			<h2 class="feedback-dialog-title">Thank you</h2>
			<p class="feedback-dialog-text">
				Your note is on its way to the maintainers. If you left an email you may
				hear back once it is sorted.
			</p>
			<div class="feedback-dialog-actions">
				<button type="button" class="feedback-btn feedback-btn-primary" data-close>Close</button>
			</div>`;
		form.querySelector('[data-close]')?.addEventListener('click', () => dialog.close());
	});
}

function markVoted(section: HTMLElement, vote: 'yes' | 'no'): void {
	section.querySelectorAll<HTMLButtonElement>('.thumb-btn').forEach((button) => {
		button.classList.toggle('active', button.dataset.feedback === vote);
		button.setAttribute('aria-pressed', String(button.dataset.feedback === vote));
	});

	let note = section.querySelector<HTMLElement>('.feedback-thanks');
	if (!note) {
		note = document.createElement('span');
		note.className = 'feedback-thanks';
		section.appendChild(note);
	}
	note.textContent = vote === 'yes' ? 'Thanks for the vote.' : 'Thanks — noted.';
}

export function initPageFeedback(): void {
	document.querySelectorAll<HTMLElement>('.feedback-section').forEach((section) => {
		if (section.dataset.initialized) return;
		section.dataset.initialized = 'true';

		const stored = readStoredVote();
		if (stored === 'yes' || stored === 'no') {
			markVoted(section, stored);
		}

		section.querySelectorAll<HTMLButtonElement>('.thumb-btn').forEach((button) => {
			button.setAttribute('aria-pressed', 'false');
			button.addEventListener('click', () => {
				const helpful = button.dataset.feedback === 'yes';
				const vote = helpful ? 'yes' : 'no';

				// The server locks one vote per page per day, so a second click
				// leaves the recorded vote alone rather than sending one that
				// would be rejected — and a double-click sends only one request.
				// The dialog still opens: sharing and commenting stay available.
				if (readStoredVote() === null) {
					markVoted(section, vote);
					storeVote(vote);

					// Fire and forget: the dialog opens straight away, and a
					// failed request should not stop someone sharing.
					void submit({ helpful });
				}

				if (helpful) {
					shareDialog();
				} else {
					commentDialog();
				}
			});
		});
	});
}
