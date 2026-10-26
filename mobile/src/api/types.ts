export type Role = 'citizen' | 'admin' | 'super_admin' | 'department_admin' | 'field_worker';

export type SessionUser = {
  _id: string;
  name: string;
  email: string;
  role: Role;
  points: number;
  avatar?: string | null;
  username?: string | null;
  city?: string | null;
  ward?: string | null;
};

export type AuthResponse = SessionUser & { token: string };

export type Profile = SessionUser & {
  badges: string[];
  reportsCount: number;
  reportsResolved: number;
  levelInfo: { level: number; name: string; currentXp: number; nextLevelXp: number; progress: number };
  impactScore: number;
  region?: string | null;
  interests: string[];
  followingCount: number;
};

export type IssueAuthor = {
  _id?: string;
  name: string;
  avatar?: string | null;
  role?: string;
  isPage?: boolean;
  handle?: string;
  verified?: boolean;
};

export type TimelineEntry = {
  status: string;
  timestamp: string;
  updatedBy?: string | null;
  updatedByUser?: { _id: string; name: string; role?: string } | null;
  comment?: string | null;
  dept?: string | null;
};

export type Issue = {
  _id: string;
  user: IssueAuthor;
  title: string;
  description: string;
  image?: string | null;
  video?: string | null;
  location: { coordinates: [number, number]; address?: string | null };
  departmentTag?: string | null;
  status: string;
  category: string;
  priorityScore: number;
  aiSeverity: string;
  aiTags: string[];
  upvotes: string[];
  downvotes: string[];
  followers?: string[];
  commentCount: number;
  reportsCount?: number;
  statusTimeline?: TimelineEntry[];
  resolutionProof?: { afterImage?: string | null; workerRemarks?: string | null; resolvedAt?: string | null; resolvedBy?: string | null } | null;
  assignedTo?: string | null;
  assignedToUser?: { _id: string; name: string } | null;
  deadline?: string | null;
  anonymous?: boolean;
  emergency?: boolean;
  authorType?: 'User' | 'MunicipalPage';
  /** Municipal page id for official posts. */
  municipalPage?: string | null;
  officialUpdateType?: string | null;
  timeAgo?: string;
  createdAt: string;
  updatedAt?: string;
};

export type FeedFilter = 'all' | 'trending' | 'following' | 'high_priority' | 'resolved' | 'my_posts';

export type Comment = {
  _id: string;
  issueId: string;
  user: { _id?: string; name: string; role?: string };
  text: string;
  likes?: number;
  timeAgo?: string;
  createdAt: string;
};

export type GroupReport = {
  id: string;
  reporter_username?: string | null;
  reporter_anonymous?: boolean;
  title?: string;
  description?: string;
  image?: string | null;
  location_address?: string | null;
  created_at: string;
};

export type ImageAnalysis = {
  isValid: boolean;
  rejectionReason?: string | null;
  category: string;
  confidence: number;
  severity: string;
  title: string;
  description: string;
  observations?: string[];
  isEmergency: boolean;
  departmentTag: string;
  priorityScore: number;
  tags: string[];
  model?: string;
  latencyMs?: number;
  cached?: boolean;
};

export type DuplicateCheck = {
  exists: boolean;
  match: null | {
    issueId: string;
    title: string;
    image?: string | null;
    address?: string | null;
    distanceMeters: number;
    confidence: number;
    createdAt: string;
  };
};

export type Notification = {
  _id: string;
  type: string;
  title: string;
  desc: string;
  read: boolean;
  issueId?: string | null;
  createdAt: string;
};

export type LeaderboardEntry = { rank: number; _id: string; name: string; points: number; reportsCount: number; avatar?: string | null };

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  goal: number;
  progress: number;
  earned: boolean;
};

export type CityStats = { totalIssues: number; resolved: number; critical: number; inProgress: number; pending: number };

export type MunicipalPage = {
  _id: string;
  name: string;
  handle: string;
  department?: string | null;
  region?: { city?: string; ward?: string } | null;
  verified?: boolean;
  followers_count?: number;
  avatar?: string | null;
  cover_image?: string | null;
  description?: string | null;
  contact_email?: string | null;
  page_type?: string | null;
  isFollowing?: boolean;
};

export type AssistantIssueCard = {
  id: string;
  title: string;
  status: string;
  category: string;
  severity?: string;
  address?: string | null;
  distanceKm?: number | null;
  image?: string | null;
  createdAt?: string;
};

export type AssistantReply = {
  reply: string;
  issues: AssistantIssueCard[];
  suggestions: string[];
  toolsUsed?: string[];
  model?: string;
  latencyMs?: number;
};

export type MapIssue = {
  id: string;
  title: string;
  severity: string;
  status: string;
  category: string;
  upvotes: number;
  emergency: boolean;
  address?: string | null;
  image?: string | null;
};

export type MapCollection = {
  type: 'FeatureCollection';
  features: { geometry: { coordinates: [number, number] }; properties: MapIssue }[];
};

export type IssueExplanation = { whyItMatters: string; whatHappensNext: string; staySafe: string; model?: string };
