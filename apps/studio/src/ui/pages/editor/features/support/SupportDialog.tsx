import { useMemo, useState, type ReactNode } from 'react';
import { Coffee, Copy, ExternalLink, HeartHandshake, Mail, Share2, Star } from 'lucide-react';
import { AppDialog } from '@ui/_shared/components/Dialog/AppDialog';
import { LinkSharer } from '@presentation/support/services/LinkSharer';
import { TextClipboard } from '@presentation/support/services/TextClipboard';

const GITHUB_REPO_URL = 'https://github.com/francozanardi/tscaps';
const GITHUB_SPONSOR_URL = 'https://github.com/sponsors/francozanardi';
const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/francozanardi';
const TRUSTPILOT_URL = 'https://www.trustpilot.com/review/tscaps.io';
const FEEDBACK_EMAIL = 'franco@tscaps.io';
const SHARE_URL = 'https://tscaps.io';
const SHARE_TITLE = 'tscaps';
const SHARE_TEXT = 'Animated subtitles in your browser. Open source.';

const SHARE_FEEDBACK_MS = 2400;

const SECTION_TITLE = 'text-sm font-semibold text-fg-primary m-0';
const SECTION_NOTE = 'text-xs text-fg-muted leading-snug m-0';
const CLOSING_LINE = 'text-sm text-fg-secondary leading-relaxed m-0';

interface SupportDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * "Support tscaps" modal. Lists the concrete ways a user can help the
 * project — free (share, review, star, feedback) and paid (donation,
 * sponsorship, and on close builds the hosted plan). Every row that
 * hits an external site opens in a new tab with `noopener`.
 */
export function SupportDialog({ open, onClose }: SupportDialogProps) {
  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="lg"
      title="Support tscaps"
      description="Hey, I'm Franco. I build tscaps on my own. Here are some ways you can help."
      showCloseButton
    >
      <div className="flex flex-col gap-6">
        <FreeSection />
        <PaidSection />
        <p className={CLOSING_LINE}>Whatever you pick, thanks.</p>
      </div>
    </AppDialog>
  );
}

function FreeSection() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={SECTION_TITLE}>Free</h3>
      <p className={SECTION_NOTE}>
        Any of these helps more people find tscaps. That gets me closer to making a living
        from it.
      </p>
      <div className="flex flex-col gap-2">
        <ShareRow />
        <ExternalRow
          icon={<Star size={18} strokeWidth={1.75} />}
          title="Star on GitHub"
          subtitle="Stars help the repo show up more on GitHub."
          href={GITHUB_REPO_URL}
        />
        <ExternalRow
          icon={<Star size={18} strokeWidth={1.75} />}
          title="Leave a Trustpilot review"
          subtitle="Reviews help tscaps get seen and trusted."
          href={TRUSTPILOT_URL}
        />
        <EmailCopyRow />
      </div>
    </section>
  );
}

function PaidSection() {
  return (
    <section className="flex flex-col gap-3">
      <h3 className={SECTION_TITLE}>Paid</h3>
      <p className={SECTION_NOTE}>
        Any of these pays for the time I spend on tscaps.
      </p>
      <div className="flex flex-col gap-2">
        <ExternalRow
          icon={<Coffee size={18} strokeWidth={1.75} />}
          title="Buy me a coffee"
          subtitle="A one-time donation of any amount."
          href={BUY_ME_A_COFFEE_URL}
        />
        <ExternalRow
          icon={<HeartHandshake size={18} strokeWidth={1.75} />}
          title="Sponsor on GitHub"
          subtitle="A monthly donation through GitHub Sponsors."
          href={GITHUB_SPONSOR_URL}
        />
      </div>
    </section>
  );
}

const ROW =
  'flex items-start gap-3 p-3 rounded-sm border border-edge-subtle bg-surface-1 ' +
  'text-left cursor-pointer no-underline transition-colors duration-quick ease-standard ' +
  'hover:bg-surface-3 hover:border-edge-medium ' +
  'focus-visible:outline-none focus-visible:border-accent';

const ROW_ICON = 'shrink-0 text-fg-secondary mt-0.5';
const ROW_TITLE = 'text-sm font-medium text-fg-primary m-0';
const ROW_SUBTITLE = 'text-xs text-fg-muted leading-snug m-0';
const ROW_HINT = 'shrink-0 text-fg-faint self-center';

interface RowLayoutProps {
  icon: ReactNode;
  title: ReactNode;
  subtitle: ReactNode;
  hint?: ReactNode;
}

function RowLayout({ icon, title, subtitle, hint }: RowLayoutProps) {
  return (
    <>
      <span className={ROW_ICON}>{icon}</span>
      <span className="flex-1 min-w-0 flex flex-col gap-0.5">
        <span className={ROW_TITLE}>{title}</span>
        <span className={ROW_SUBTITLE}>{subtitle}</span>
      </span>
      {hint !== undefined && <span className={ROW_HINT}>{hint}</span>}
    </>
  );
}

interface ExternalRowProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  href: string;
}

function ExternalRow({ icon, title, subtitle, href }: ExternalRowProps) {
  return (
    <a
      className={ROW}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      <RowLayout
        icon={icon}
        title={title}
        subtitle={subtitle}
        hint={<ExternalLink size={14} strokeWidth={1.75} />}
      />
    </a>
  );
}

function ShareRow() {
  const sharer = useMemo(() => new LinkSharer(new TextClipboard()), []);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleShare = () => {
    sharer.share({ url: SHARE_URL, title: SHARE_TITLE, text: SHARE_TEXT }).then((outcome) => {
      if (outcome === 'shared') setFeedback('Shared. Thanks.');
      else if (outcome === 'copied') setFeedback('Link copied.');
      else setFeedback(`Copy this link: ${SHARE_URL}`);
      window.setTimeout(() => setFeedback(null), SHARE_FEEDBACK_MS);
    });
  };

  const subtitle = feedback ?? `Send ${SHARE_URL} to a friend or post it anywhere.`;

  return (
    <button type="button" className={ROW} onClick={handleShare}>
      <RowLayout
        icon={<Share2 size={18} strokeWidth={1.75} />}
        title="Share tscaps"
        subtitle={subtitle}
      />
    </button>
  );
}

function EmailCopyRow() {
  const clipboard = useMemo(() => new TextClipboard(), []);
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleCopy = () => {
    clipboard.copy(FEEDBACK_EMAIL).then((copied) => {
      setFeedback(copied ? 'Email copied.' : `Copy this: ${FEEDBACK_EMAIL}`);
      window.setTimeout(() => setFeedback(null), SHARE_FEEDBACK_MS);
    });
  };

  const subtitle = feedback ?? 'Bugs, ideas, or a hello. I reply to all.';

  return (
    <button type="button" className={ROW} onClick={handleCopy}>
      <RowLayout
        icon={<Mail size={18} strokeWidth={1.75} />}
        title="Send me feedback"
        subtitle={subtitle}
        hint={<Copy size={14} strokeWidth={1.75} />}
      />
    </button>
  );
}
