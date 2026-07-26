/**
 * The notification email sent when a reader marks a page as unhelpful.
 *
 * Kept apart from the request handling so the template can be rendered and
 * eyeballed without a Workers runtime, and so `feedback.ts` stays about
 * validation rather than MIME.
 */

export interface Notification {
	page: string;
	reason: string | null;
	comment: string;
	contactEmail: string | null;
	country: string | null;
}

const SITE = 'https://openplanetdata.com';

const REASON_LABELS: Record<string, string> = {
	inaccurate: 'Inaccurate',
	outdated: 'Out of date',
	confusing: 'Hard to follow',
	incomplete: 'Not detailed enough',
	missing: "Didn't cover their case",
	broken: 'Broken link or example',
	other: 'Something else',
};

/** Turns the stored reason slug back into the wording the reader chose. */
export function resolveReason(reason: string | null): string {
	if (!reason) return 'Not specified';
	return REASON_LABELS[reason] ?? reason;
}

/** The whole message, ready to hand to the send_email binding. */
export function buildFeedbackEmail(options: {
	from: string;
	to: string;
	feedback: Notification;
}): string {
	const { from, to, feedback } = options;
	const reason = resolveReason(feedback.reason);

	return buildMessage({
		from,
		to,
		subject: `Page feedback: ${feedback.page}`,
		replyTo: feedback.contactEmail,
		text: textBody(feedback, reason),
		html: htmlBody(feedback, reason),
	});
}

export function textBody(feedback: Notification, reason: string): string {
	return [
		'Someone marked a documentation page as unhelpful.',
		'',
		`Page:    ${SITE}${feedback.page}`,
		`Problem: ${reason}`,
		`Country: ${feedback.country ?? 'Unknown'}`,
		`Reply:   ${feedback.contactEmail ?? 'Not provided'}`,
		'',
		'What they said',
		'--------------',
		feedback.comment,
		'',
		'--',
		`Open the page:  ${SITE}${feedback.page}`,
		`All statistics: ${SITE}/statistics/`,
	].join('\n');
}

/**
 * Table-based layout with inline styles and no external assets: that is what
 * survives Gmail, Outlook and the rest. `prefers-color-scheme` is honoured by
 * the clients that support it and ignored harmlessly by those that do not.
 */
export function htmlBody(feedback: Notification, reason: string): string {
	const row = (label: string, value: string) => `
		<tr>
			<td style="padding:6px 16px 6px 0;font-size:13px;color:#8a7f72;white-space:nowrap;vertical-align:top;">${label}</td>
			<td style="padding:6px 0;font-size:13px;color:#332e28;vertical-align:top;">${value}</td>
		</tr>`;

	const pageUrl = `${SITE}${escapeHtml(feedback.page)}`;
	const replyCell = feedback.contactEmail
		? `<a href="mailto:${escapeHtml(feedback.contactEmail)}" style="color:#2d6a4f;">${escapeHtml(feedback.contactEmail)}</a>`
		: '<span style="color:#8a7f72;">Not provided</span>';

	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Page feedback</title>
</head>
<body style="margin:0;padding:0;background:#ece6dd;">
	<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(truncate(feedback.comment, 120))}</div>
	<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ece6dd;padding:28px 12px;">
		<tr><td align="center">
			<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
				style="max-width:560px;background:#fffcf7;border:1px solid #e4dbd0;border-radius:16px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,sans-serif;">

				<tr><td style="padding:22px 28px 0;">
					<div style="font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:#8a7f72;">
						OpenPlanetData
					</div>
					<h1 style="margin:8px 0 4px;font-size:21px;font-weight:600;color:#332e28;">
						A page was marked unhelpful
					</h1>
					<p style="margin:0;font-size:14px;line-height:1.55;color:#544d44;">
						Someone read a documentation page and told us it missed the mark.
					</p>
				</td></tr>

				<tr><td style="padding:18px 28px 0;">
					<table role="presentation" cellpadding="0" cellspacing="0" width="100%">
						${row('Page', `<a href="${pageUrl}" style="color:#2d6a4f;">${escapeHtml(feedback.page)}</a>`)}
						${row('Problem', escapeHtml(reason))}
						${row('Country', escapeHtml(feedback.country ?? 'Unknown'))}
						${row('Reply to', replyCell)}
					</table>
				</td></tr>

				<tr><td style="padding:18px 28px 0;">
					<div style="border-left:3px solid #2d6a4f;background:#f4f0e9;border-radius:0 10px 10px 0;padding:14px 16px;">
						<div style="font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#8a7f72;margin-bottom:6px;">
							What they said
						</div>
						<div style="font-size:15px;line-height:1.6;color:#332e28;white-space:pre-wrap;">${escapeHtml(feedback.comment)}</div>
					</div>
				</td></tr>

				<tr><td style="padding:22px 28px 6px;">
					<a href="${pageUrl}"
						style="display:inline-block;background:#2d6a4f;color:#ffffff;text-decoration:none;
							font-size:14px;font-weight:600;padding:11px 20px;border-radius:50px;">
						Open the page
					</a>
				</td></tr>

				<tr><td style="padding:14px 28px 24px;">
					<div style="border-top:1px solid #e4dbd0;padding-top:14px;font-size:12px;line-height:1.6;color:#8a7f72;">
						${
							feedback.contactEmail
								? 'Replying to this email reaches the person who wrote it.'
								: 'They left no address, so there is nobody to reply to.'
						}
						<br>
						<a href="${SITE}/statistics/" style="color:#8a7f72;">See all statistics</a>
					</div>
				</td></tr>
			</table>
		</td></tr>
	</table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function truncate(value: string, max: number): string {
	return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

interface MessageParts {
	from: string;
	to: string;
	subject: string;
	replyTo: string | null;
	text: string;
	html: string;
}

/**
 * multipart/alternative: clients that render HTML get the designed version,
 * everything else (and plain-text readers) falls back to the text part.
 */
export function buildMessage({ from, to, subject, replyTo, text, html }: MessageParts): string {
	const boundary = `opd-${crypto.randomUUID()}`;

	const headers = [
		`From: OpenPlanetData <${from}>`,
		`To: <${to}>`,
		replyTo ? `Reply-To: <${replyTo}>` : null,
		`Subject: ${encodeSubject(subject)}`,
		`Message-ID: <${crypto.randomUUID()}@openplanetdata.com>`,
		`Date: ${new Date().toUTCString()}`,
		'MIME-Version: 1.0',
		`Content-Type: multipart/alternative; boundary="${boundary}"`,
	].filter((line): line is string => line !== null);

	// Both parts are base64: visitor-supplied text then cannot reach the
	// header/body grammar, so no combination of newlines, boundaries or
	// non-ASCII can restructure the message.
	const parts = [
		`--${boundary}`,
		'Content-Type: text/plain; charset="utf-8"',
		'Content-Transfer-Encoding: base64',
		'',
		base64Lines(text),
		'',
		`--${boundary}`,
		'Content-Type: text/html; charset="utf-8"',
		'Content-Transfer-Encoding: base64',
		'',
		base64Lines(html),
		'',
		`--${boundary}--`,
	];

	return `${headers.join('\r\n')}\r\n\r\n${parts.join('\r\n')}`;
}

/**
 * RFC 2047 encoded-word, so a page path with non-ASCII stays readable in the
 * subject line instead of being stripped.
 */
function encodeSubject(value: string): string {
	const clean = value.replace(/[\r\n]+/g, ' ').slice(0, 200);
	// eslint-disable-next-line no-control-regex
	if (/^[\x20-\x7E]*$/.test(clean)) return clean;
	return `=?utf-8?B?${base64Utf8(clean)}?=`;
}

function base64Utf8(text: string): string {
	const bytes = new TextEncoder().encode(text);
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function base64Lines(text: string): string {
	const encoded = base64Utf8(text);
	const lines: string[] = [];
	for (let index = 0; index < encoded.length; index += 76) {
		lines.push(encoded.slice(index, index + 76));
	}
	return lines.join('\r\n');
}
