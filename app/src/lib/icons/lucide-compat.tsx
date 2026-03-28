import * as React from 'react';
import type { LucideProps } from '@lucide-real';
export * from '@lucide-real';

type IconComponent = React.FC<LucideProps>;

function createRoundedIcon(src: string): IconComponent {
  const RoundedIcon: IconComponent = ({
    className,
    size = 24,
    color,
    style,
    ...rest
  }) => {
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
      <span
        {...rest}
        className={className}
        style={{
          display: 'inline-block',
          width: dimension,
          height: dimension,
          flexShrink: 0,
          backgroundColor: color ?? 'currentColor',
          WebkitMaskImage: `url("${src}")`,
          maskImage: `url("${src}")`,
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskPosition: 'center',
          maskPosition: 'center',
          WebkitMaskSize: 'contain',
          maskSize: 'contain',
          ...style,
        }}
      />
    );
  };

  RoundedIcon.displayName = `RoundedIcon(${src.split('/').pop()})`;
  return RoundedIcon;
}

function createCustomIcon(
  viewBox: string,
  content: React.ReactNode,
  options?: { fill?: boolean; strokeWidth?: number }
): IconComponent {
  const { fill = false, strokeWidth = 1.8 } = options ?? {};

  const CustomIcon: IconComponent = ({
    className,
    size = 24,
    color,
    style,
    ...rest
  }) => {
    const dimension = typeof size === 'number' ? `${size}px` : size;

    return (
      <svg
        {...rest}
        className={className}
        width={dimension}
        height={dimension}
        viewBox={viewBox}
        fill={fill ? color ?? 'currentColor' : 'none'}
        stroke={fill ? 'none' : color ?? 'currentColor'}
        strokeWidth={fill ? undefined : strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        style={style}
      >
        {content}
      </svg>
    );
  };

  return CustomIcon;
}

const base = '/icons/icons/hugeroundedicons';

const CheckMark = (
  <path d="M5.5 12.5L10 17l8.5-9" />
);
const CircleShape = (
  <circle cx="12" cy="12" r="8.5" />
);
const ClockShape = (
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5v5l3 2" />
  </>
);
const RefreshShape = (
  <>
    <path d="M19 8.5A7.5 7.5 0 0 0 6.4 5.9" />
    <path d="M19 4.5v4h-4" />
    <path d="M5 15.5A7.5 7.5 0 0 0 17.6 18.1" />
    <path d="M5 19.5v-4h4" />
  </>
);
const LoaderShape = (
  <>
    <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" opacity="0.38" />
    <path d="M20.5 12A8.5 8.5 0 0 0 12 3.5" />
  </>
);
const LockShape = (
  <>
    <rect x="5.5" y="10.5" width="13" height="9" rx="2.5" />
    <path d="M8.5 10.5V8.5a3.5 3.5 0 0 1 7 0v2" />
  </>
);
const KeyShape = (
  <>
    <circle cx="8.5" cy="12" r="3.5" />
    <path d="M12 12h8" />
    <path d="M17 12v-2" />
    <path d="M19.5 12v-2" />
  </>
);
const EyeShape = (
  <>
    <path d="M2.5 12s3.2-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.2 5.5-9.5 5.5S2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.7" />
  </>
);
const EyeOffShape = (
  <>
    <path d="M3.5 3.5 20.5 20.5" />
    <path d="M10 6.8c.65-.2 1.33-.3 2-.3 6.3 0 9.5 5.5 9.5 5.5a18.9 18.9 0 0 1-3.9 4.3" />
    <path d="M14.2 14.3a2.7 2.7 0 0 1-3.5-3.5" />
    <path d="M6.4 17A18.8 18.8 0 0 1 2.5 12s1.6-2.8 4.8-4.5" />
  </>
);
const MinusShape = (
  <path d="M6 12h12" />
);
const HashShape = (
  <>
    <path d="M9 4 7 20" />
    <path d="M17 4l-2 16" />
    <path d="M4.5 9.5h15" />
    <path d="M3.5 14.5h15" />
  </>
);
const CloudShape = (
  <path d="M7.5 18.5h9.2a4.3 4.3 0 0 0 .7-8.5A5.8 5.8 0 0 0 6.6 8.6 3.9 3.9 0 0 0 7.5 18.5Z" />
);
const WifiShape = (
  <>
    <path d="M4.5 9.5a11.3 11.3 0 0 1 15 0" />
    <path d="M7.5 12.5a7 7 0 0 1 9 0" />
    <path d="M10.5 15.5a2.8 2.8 0 0 1 3 0" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </>
);
const WifiOffShape = (
  <>
    <path d="M3.5 4 20.5 20" />
    <path d="M5.2 10.2a11.3 11.3 0 0 1 8.3-1.7" />
    <path d="M8.2 13.2a6.9 6.9 0 0 1 3.3-.7" />
    <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
  </>
);
const GripVerticalShape = (
  <>
    {[7, 12, 17].map((y) => (
      <React.Fragment key={`left-${y}`}>
        <circle cx="9" cy={y} r="1.15" fill="currentColor" stroke="none" />
        <circle cx="15" cy={y} r="1.15" fill="currentColor" stroke="none" />
      </React.Fragment>
    ))}
  </>
);
const SquareShape = (
  <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" />
);
const MonitorShape = (
  <>
    <rect x="4" y="5" width="16" height="11" rx="2.5" />
    <path d="M9 19h6" />
    <path d="M12 16v3" />
  </>
);
const SparkShape = (
  <>
    <path d="m12 3 1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Z" />
  </>
);
const ZapShape = (
  <path d="M13.5 2.5 6.5 13h4l-1 8.5 7-10.5h-4l1-8Z" />
);
const ScissorsShape = (
  <>
    <circle cx="7" cy="17" r="2.5" />
    <circle cx="7" cy="7" r="2.5" />
    <path d="M9 15.5 18 21" />
    <path d="M9 8.5 18 3" />
  </>
);
const VideoShape = (
  <>
    <rect x="4" y="6.5" width="11.5" height="11" rx="2.5" />
    <path d="M15.5 10 20 7.5v9l-4.5-2.5" />
  </>
);

export const AlertCircle = createRoundedIcon(`${base}/alert-01-stroke-rounded.svg`);
export const AlertTriangle = createRoundedIcon(`${base}/alert-01-stroke-rounded.svg`);
export const Archive = createRoundedIcon(`${base}/archive-04-stroke-rounded.svg`);
export const Auction = createRoundedIcon(`${base}/auction-stroke-rounded.svg`);
export const ArrowLeft = createRoundedIcon(`${base}/arrow-left-02-stroke-rounded.svg`);
export const ArrowRight = createRoundedIcon(`${base}/arrow-right-02-stroke-rounded.svg`);
export const ArrowUp = createRoundedIcon(`${base}/arrow-up-02-stroke-rounded.svg`);
export const ArrowDown = createRoundedIcon(`${base}/arrow-down-02-stroke-rounded.svg`);
export const ChevronDownIcon = createRoundedIcon(`${base}/arrow-down-01-stroke-rounded.svg`);
export const ArrowDownWideNarrow = createRoundedIcon(`${base}/filter-stroke-rounded.svg`);
export const Activity = createRoundedIcon(`${base}/chat-feedback-stroke-rounded.svg`);
export const Bell = createRoundedIcon(`${base}/notification-01-stroke-rounded.svg`);
export const Bookmark = createRoundedIcon(`${base}/bookmark-02-stroke-rounded.svg`);
export const BookmarkCheck = createRoundedIcon(`${base}/bookmark-02-solid-rounded.svg`);
export const BookOpen = createRoundedIcon(`${base}/book-open-01-stroke-rounded.svg`);
export const Brush = createRoundedIcon(`${base}/brush-stroke-rounded.svg`);
export const Brain = createRoundedIcon(`${base}/chat-feedback-01-stroke-rounded.svg`);
export const Calendar = createCustomIcon('0 0 24 24', ClockShape);
export const CalendarClock = createCustomIcon('0 0 24 24', ClockShape);
export const CalendarDays = createCustomIcon('0 0 24 24', ClockShape);
export const CalendarIcon = createCustomIcon('0 0 24 24', ClockShape);
export const ChannelsIcon = createRoundedIcon(`${base}/play-stroke-rounded.svg`);
export const Check = createCustomIcon('0 0 24 24', CheckMark);
export const CheckCircle = createCustomIcon('0 0 24 24', <>{CircleShape}{CheckMark}</>);
export const CheckCircle2 = createCustomIcon('0 0 24 24', <>{CircleShape}{CheckMark}</>);
export const CheckIcon = createCustomIcon('0 0 24 24', CheckMark);
export const ChevronLeft = createRoundedIcon(`${base}/arrow-left-02-stroke-rounded.svg`);
export const ChevronRight = createRoundedIcon(`${base}/arrow-right-01-stroke-rounded.svg`);
export const ChevronUp = createRoundedIcon(`${base}/arrow-up-02-stroke-rounded.svg`);
export const ChevronDown = createRoundedIcon(`${base}/arrow-down-02-stroke-rounded.svg`);
export const ChevronRightIcon = createRoundedIcon(`${base}/arrow-right-01-stroke-rounded.svg`);
export const Circle = createCustomIcon('0 0 24 24', CircleShape);
export const CircleIcon = createCustomIcon('0 0 24 24', CircleShape);
export const Cloud = createCustomIcon('0 0 24 24', CloudShape);
export const CloudRounded = createRoundedIcon(`${base}/cloud-stroke-rounded.svg`);
export const Clock = createCustomIcon('0 0 24 24', ClockShape);
export const Clock01 = createRoundedIcon(`${base}/clock-01-stroke-rounded.svg`);
export const Command = createRoundedIcon(`${base}/menu-09-stroke-rounded.svg`);
export const Comment = createRoundedIcon(`${base}/comment-02-stroke-rounded.svg`);
export const MessageSquare = createRoundedIcon(`${base}/bubble-chat-stroke-rounded.svg`);
export const Copy = createRoundedIcon(`${base}/border-full-stroke-rounded.svg`);
export const Download = createRoundedIcon(`${base}/download-06-stroke-rounded.svg`);
export const Edit = createRoundedIcon(`${base}/pen-01-stroke-rounded.svg`);
export const Edit2 = createRoundedIcon(`${base}/pen-01-stroke-rounded.svg`);
export const PenSquare = createRoundedIcon(`${base}/pencil-edit-02-stroke-rounded.svg`);
export const ExternalLink = createRoundedIcon(`${base}/share-04-stroke-rounded.svg`);
export const Eye = createCustomIcon('0 0 24 24', EyeShape);
export const EyeOff = createCustomIcon('0 0 24 24', EyeOffShape);
export const Award = createRoundedIcon(`${base}/favourite-stroke-rounded.svg`);
export const Clapperboard = createRoundedIcon(`${base}/play-square-stroke-rounded.svg`);
export const Expand = createRoundedIcon(`${base}/expand-stroke-rounded.svg`);
export const FileImage = createRoundedIcon(`${base}/image-01-stroke-rounded.svg`);
export const FilePenLine = createRoundedIcon(`${base}/pen-01-stroke-rounded.svg`);
export const FileSpreadsheet = createRoundedIcon(`${base}/border-full-stroke-rounded.svg`);
export const FileText = createRoundedIcon(`${base}/filter-mail-square-stroke-rounded.svg`);
export const FileVideo = createCustomIcon('0 0 24 24', VideoShape);
export const Filter = createRoundedIcon(`${base}/filter-horizontal-stroke-rounded.svg`);
export const Film = createRoundedIcon(`${base}/play-square-stroke-rounded.svg`);
export const Folder = createRoundedIcon(`${base}/folder-01-stroke-rounded.svg`);
export const Globe2 = createRoundedIcon(`${base}/language-circle-stroke-rounded.svg`);
export const Globe = createRoundedIcon(`${base}/language-circle-stroke-rounded.svg`);
export const GripVertical = createCustomIcon('0 0 24 24', GripVerticalShape, { fill: true });
export const GripVerticalIcon = createCustomIcon('0 0 24 24', GripVerticalShape, { fill: true });
export const Hash = createCustomIcon('0 0 24 24', HashShape);
export const HardDrive = createRoundedIcon(`${base}/activity-01-stroke-rounded.svg`);
export const HelpCircle = createRoundedIcon(`${base}/help-circle-stroke-rounded.svg`);
export const Home = createRoundedIcon(`${base}/home-01-stroke-rounded.svg`);
export const Image = createRoundedIcon(`${base}/image-01-stroke-rounded.svg`);
export const ImageIcon = createRoundedIcon(`${base}/image-01-stroke-rounded.svg`);
export const ImagePlus = createRoundedIcon(`${base}/image-01-bold-rounded.svg`);
export const Info = createRoundedIcon(`${base}/information-circle-stroke-rounded.svg`);
export const InformationCircle = createRoundedIcon(`${base}/information-circle-stroke-rounded.svg`);
export const Keyboard = createRoundedIcon(`${base}/menu-09-stroke-rounded.svg`);
export const Key = createCustomIcon('0 0 24 24', KeyShape);
export const LayoutDashboard = createRoundedIcon(`${base}/home-01-stroke-rounded.svg`);
export const Layout = createRoundedIcon(`${base}/border-full-stroke-rounded.svg`);
export const Loader2 = createCustomIcon('0 0 24 24', LoaderShape);
export const Lock = createCustomIcon('0 0 24 24', LockShape);
export const LogOut = createRoundedIcon(`${base}/logout-01-stroke-rounded.svg`);
export const Mail = createRoundedIcon(`${base}/mail-01-stroke-rounded.svg`);
export const MailIcon = createRoundedIcon(`${base}/mail-01-stroke-rounded.svg`);
export const MapPin = createRoundedIcon(`${base}/pin-stroke-rounded.svg`);
export const Maximize = createRoundedIcon(`${base}/expand-stroke-rounded.svg`);
export const Menu = createRoundedIcon(`${base}/menu-09-stroke-rounded.svg`);
export const Mic = createRoundedIcon(`${base}/mic-02-stroke-rounded.svg`);
export const Mic2 = createRoundedIcon(`${base}/mic-02-stroke-rounded.svg`);
export const MoreHorizontal = createRoundedIcon(`${base}/more-horizontal-circle-01-stroke-rounded.svg`);
export const MoreVertical = createRoundedIcon(`${base}/more-vertical-circle-01-stroke-rounded.svg`);
export const Moon = createRoundedIcon(`${base}/moon-02-stroke-rounded.svg`);
export const MinusIcon = createCustomIcon('0 0 24 24', MinusShape);
export const Monitor = createCustomIcon('0 0 24 24', MonitorShape);
export const Pause = createRoundedIcon(`${base}/pause-stroke-rounded.svg`);
export const Palette = createRoundedIcon(`${base}/paint-brush-04-stroke-rounded.svg`);
export const PanelLeftClose = createRoundedIcon(`${base}/layout-left-stroke-rounded.svg`);
export const PanelLeftIcon = createRoundedIcon(`${base}/menu-09-stroke-rounded.svg`);
export const PanelLeftOpen = createRoundedIcon(`${base}/layout-right-stroke-rounded.svg`);
export const Pin = createRoundedIcon(`${base}/pin-stroke-rounded.svg`);
export const PinOff = createRoundedIcon(`${base}/pin-stroke-rounded.svg`);
export const Play = createRoundedIcon(`${base}/play-stroke-rounded.svg`);
export const PlaySquare = createRoundedIcon(`${base}/play-square-stroke-rounded.svg`);
export const Plus = createRoundedIcon(`${base}/plus-sign-stroke-rounded.svg`);
export const PoliceBadge = createRoundedIcon(`${base}/police-badge-stroke-rounded.svg`);
export const RefreshCw = createCustomIcon('0 0 24 24', RefreshShape);
export const RotateCcw = createCustomIcon('0 0 24 24', RefreshShape);
export const Rss = createRoundedIcon(`${base}/filter-mail-square-stroke-rounded.svg`);
export const Scissors = createCustomIcon('0 0 24 24', ScissorsShape);
export const Search = createRoundedIcon(`${base}/search-01-stroke-rounded.svg`);
export const SearchIcon = createRoundedIcon(`${base}/search-01-stroke-rounded.svg`);
export const Send = createRoundedIcon(`${base}/sent-stroke-rounded.svg`);
export const Settings = createRoundedIcon(`${base}/settings-03-stroke-rounded.svg`);
export const Share2 = createRoundedIcon(`${base}/share-08-stroke-rounded.svg`);
export const Share = createRoundedIcon(`${base}/share-04-stroke-rounded.svg`);
export const Shield = createRoundedIcon(`${base}/police-badge-stroke-rounded.svg`);
export const SlidersHorizontal = createRoundedIcon(`${base}/sliders-horizontal-stroke-rounded.svg`);
export const Smartphone = createRoundedIcon(`${base}/user-stroke-rounded.svg`);
export const Smartphone03 = createRoundedIcon(`${base}/smart-phone-03-stroke-rounded.svg`);
export const Sparkles = createCustomIcon('0 0 24 24', SparkShape);
export const Square = createCustomIcon('0 0 24 24', SquareShape);
export const Star = createRoundedIcon(`${base}/star-stroke-rounded.svg`);
export const Sun = createRoundedIcon(`${base}/sun-03-stroke-rounded.svg`);
export const Tag = createRoundedIcon(`${base}/bookmark-02-stroke-rounded.svg`);
export const Target = createRoundedIcon(`${base}/border-full-stroke-rounded.svg`);
export const ThumbsDown = createRoundedIcon(`${base}/favourite-stroke-rounded.svg`);
export const ThumbsUp = createRoundedIcon(`${base}/favourite-solid-rounded.svg`);
export const Trash2 = createRoundedIcon(`${base}/delete-01-stroke-rounded.svg`);
export const TrendingUp = createRoundedIcon(`${base}/arrow-up-02-stroke-rounded.svg`);
export const Type = createRoundedIcon(`${base}/filter-mail-square-stroke-rounded.svg`);
export const Unplug = createRoundedIcon(`${base}/logout-01-stroke-rounded.svg`);
export const Upload = createRoundedIcon(`${base}/upload-06-stroke-rounded.svg`);
export const User = createRoundedIcon(`${base}/user-stroke-rounded.svg`);
export const Video = createCustomIcon('0 0 24 24', VideoShape);
export const Video02 = createRoundedIcon(`${base}/video-02-stroke-rounded.svg`);
export const Volume2 = createRoundedIcon(`${base}/volume-high-stroke-rounded.svg`);
export const VolumeX = createRoundedIcon(`${base}/volume-off-stroke-rounded.svg`);
export const Wand2 = createRoundedIcon(`${base}/brush-stroke-rounded.svg`);
export const Wifi = createCustomIcon('0 0 24 24', WifiShape);
export const WifiOff = createCustomIcon('0 0 24 24', WifiOffShape);
export const WifiNoSignal = createRoundedIcon(`${base}/wifi-no-signal-stroke-rounded.svg`);
export const X = createRoundedIcon(`${base}/cancel-01-stroke-rounded.svg`);
export const XIcon = createRoundedIcon(`${base}/cancel-01-stroke-rounded.svg`);
export const XCircle = createRoundedIcon(`${base}/cancel-01-stroke-rounded.svg`);
export const Zap = createCustomIcon('0 0 24 24', ZapShape);
