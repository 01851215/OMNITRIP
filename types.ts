
export interface ItineraryItem {
  id: string;
  day: number;
  time: string;
  activity: string;
  location: string;
  type: 'attraction' | 'food' | 'transport' | 'hotel' | 'flight' | 'event' | 'other';
  costEstimate: number;
  notes?: string;
  lat?: number;
  lng?: number;
  bookingStatus?: 'booked' | 'pending' | 'none';
  date?: string; // YYYY-MM-DD specific date for this activity
  metadata?: {
    flightCode?: string;
    origin?: string;
    destination?: string;
    searchQuery?: string;
  };
}

export type TripPacing = 'relaxed' | 'balanced' | 'packed';
export type TripBudgetTier = 'budget' | 'medium' | 'splurge';

export interface CalendarEvent {
  id: string;
  title: string;
  start: string; // ISO String
  end: string; // ISO String
  allDay: boolean;
  source: 'google' | 'apple' | 'outlook' | 'manual' | 'upload';
}

export interface WeatherData {
  date: string; // YYYY-MM-DD
  condition: 'Sunny' | 'Cloudy' | 'Rain' | 'Snow' | 'Storm' | 'Clear';
  temp: number;
  unit: 'C' | 'F';
  precipitationChance: number; // 0-100
  summary: string;
  isSimulated?: boolean; // For demo purposes
}

export interface TripBudget {
  total: number;
  spent: number;
  currency: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  groundingLinks?: { url: string; title: string; type: 'map' | 'web' }[]; 
  timestamp: Date;
}

export type TicketStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

export interface SavedTicket {
  id: string;
  name: string; // Title of the item
  type: 'flight' | 'hotel' | 'attraction' | 'event' | 'transport';
  price: number;
  currency: string;
  date: string; // ISO Date YYYY-MM-DD
  provider: string; // e.g., "Expedia", "Delta"
  
  // Review & Verification Fields
  status: TicketStatus;
  verificationNotes?: string; // Reason for rejection or approval note
  submittedAt?: string; // ISO Timestamp
  
  // Details specific to types
  details?: {
    location?: string; // City or Address
    referenceNumber?: string; // PNR or Booking ID
    seat?: string;
    quantity?: number;
    startTime?: string;
    endTime?: string;
  };
  
  // Attachment info (mock)
  attachment?: {
    fileName: string;
    fileType: 'image' | 'pdf' | 'text';
    previewUrl?: string; // Data URL for images
  };
}

export interface OfflineKnowledge {
  culture: string;
  historyAndPolitics: string;
  leisureTips: string;
  funnyStories: string[];
  destLat?: number;
  destLng?: number;
  extendedKnowledge: string; // The "Central Data" for the AI resident
  politicsConflicts: string; // Specific deep dive into conflicts/politics
}

export interface ItineraryResponse {
  tripName: string;
  startDate?: string; // YYYY-MM-DD
  budgetPreference?: 'cheapest' | 'balanced' | 'luxury'; // NEW FIELD
  pacingPreference?: TripPacing; // NEW FIELD
  activities: {
    day: number;
    time: string;
    activity: string;
    location: string;
    type: string;
    costEstimate: number;
    notes: string;
    lat: number;
    lng: number;
    metadata?: {
        flightCode?: string;
        origin?: string;
        destination?: string;
        searchQuery?: string;
    };
  }[];
  budgetOverview: string;
  offlineKnowledge: OfflineKnowledge;
}

export interface Language {
  name: string;
  code: string;
  flag: string;
}

export interface DealOption {
  title: string;
  provider: string;
  price: number;
  currency: string;
  rating: number; // 0 to 5
  url: string;
  description: string;
  type?: 'deal' | 'alternative'; // To distinguish between a price comparison and a different option
}

export interface CarRentalOption {
  id: string;
  provider: string; // e.g. Hertz, Sixt
  carModel: string; // e.g. Toyota Corolla
  type: 'Economy' | 'SUV' | 'Luxury' | 'Convertible' | 'Van';
  pricePerDay: number;
  currency: string;
  rating: number;
  imageUrl?: string;
  features: {
    seats: number;
    transmission: 'Auto' | 'Manual';
    bags: number;
  };
  bookingUrl: string;
}

export interface InsuranceOption {
  id: string;
  providerName: string;
  planName: string;
  priceEstimate: number;
  currency: string;
  coverage: string[];
  bestFor: string; // e.g., "Adventure", "Family", "Budget"
  description: string;
}

export interface ESimOption {
  id: string;
  provider: string;
  planName: string;
  dataAmount: string; // e.g., "10GB", "Unlimited"
  duration: string; // e.g., "30 Days"
  price: number;
  currency: string;
  activationType: 'QR' | 'App' | 'Auto';
  bestFor: string; // Tag
  features: string[]; // e.g., ["Hotspot", "5G"]
  matchScore?: number; // 0-100 match based on filters
}

export interface VisaRequirement {
  destination: string;
  nationality: string;
  status: 'Required' | 'Not Required' | 'Visa on Arrival' | 'E-Visa';
  maxDays: string;
  checklist: string[];
  processingTime: string;
  embassyUrl?: string;
}

// Tracks the source of the data for UI confidence (e.g. "From Passport")
export type FieldSource = 'manual' | 'passport_doc' | 'ticket_doc' | 'user_profile';

export interface VisaFormData {
  fullName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  tripStartDate: string;
  tripEndDate: string;
  accommodationAddress: string;
  purpose: string;
  
  // Metadata for UI "Chips"
  sources?: {
    fullName?: FieldSource;
    passportNumber?: FieldSource;
    nationality?: FieldSource;
    dateOfBirth?: FieldSource;
  };
}

export interface WalkingRoute {
  name: string;
  waypoints: {
    name: string;
    lat: number;
    lng: number;
    description: string;
  }[];
  totalDistance: string;
  estimatedTime: string;
}

export interface ExplorePlace {
  id: string;
  name: string;
  category: string;
  cuisine?: string; // Specific for food
  priceLevel?: string; // $, $$, $$$
  rating: number;
  description: string;
  lat: number;
  lng: number;
  address: string;
  imageUrl?: string; // Placeholder or generic
  distance?: string; // Formatted distance (e.g. "300m")
  reviews: {
    user: string;
    text: string;
    rating: number;
  }[];
  events?: {
    name: string;
    date: string;
    description: string;
  }[];
}

export interface FriendMember {
  id: string;
  name: string;
  status: 'active' | 'offline' | 'invited' | 'removed';
  avatarColor: string; // hex for prototype
  lastUpdated: string; // e.g. "2 min ago"
  isSpeaking?: boolean; // for intercom
  lat?: number;
  lng?: number;
  inviteToken?: string;
}

export interface IntercomState {
  isEnabled: boolean;
  isTalking: boolean; // User is talking
  currentSpeakerId: string | null; // ID of friend speaking
  volume: number; // 0-100
}

export type ExploreCategory = 'All' | 'Restaurant' | 'Things to do' | 'Events' | 'Stay' | 'Landmark' | 'Guide';

// --- DOCUMENT MANAGEMENT TYPES ---

export type DocumentType = 'passport' | 'visa' | 'id_card' | 'insurance' | 'ticket' | 'other';
export type DocumentSource = 'upload' | 'manual';
export type DocumentShareStatus = 'private' | 'shared';

export interface UserDocument {
  id: string;
  title: string;
  type: DocumentType;
  source: DocumentSource;
  shareStatus: DocumentShareStatus;
  createdAt: string; // ISO date
  
  // Dynamic fields based on type
  data: {
    fullName?: string;
    passportNumber?: string;
    nationality?: string;
    dateOfBirth?: string;
    expiryDate?: string;
    policyNumber?: string;
    notes?: string;
    // For prototype, we store a fake file name to simulate attachment
    fileName?: string; 
  };
}

// Extracted profile for autofill purposes
export interface AutofillProfile {
  fullName: string;
  passportNumber: string;
  nationality: string;
  dateOfBirth: string;
  expiryDate?: string;
  sourceDocId?: string; // Traceability
}

// --- BUDGET & COMMERCE TYPES ---

export type PaymentMethodType = 'card' | 'apple_pay' | 'google_pay';

export interface PaymentMethod {
  id: string;
  type: PaymentMethodType;
  label: string; // e.g. "Visa ending 4242" or "Apple Pay"
  last4?: string;
  brand?: 'visa' | 'mastercard' | 'amex' | 'default';
}

export interface BudgetItem {
  id: string;
  segmentId: string; // Scoped to trip
  source: 'schedule' | 'extras' | 'manual' | 'plan_auto'; 
  type: 'flight' | 'hotel' | 'attraction' | 'insurance' | 'transport' | 'other' | 'stay';
  title: string;
  amount: number;
  currency: string;
  status: 'planned' | 'paid' | 'confirmed' | 'failed';
  
  // Details
  providerName?: string;
  start_date?: string;
  end_date?: string;
  travelers?: number;
  notes?: string;
  
  // Fulfillment
  confirmationCode?: string;
  failReason?: string;
  createdAt: string;
}

export interface BudgetAccounting {
  totalBudget: number;
  scheduleConfirmedSpent: number; // Sum of ItineraryItems where status='booked'
  budgetItemsSpent: number; // Sum of BudgetItem in list
  spentTotal: number;
  remaining: number;
  currency: string;
}

export interface OrderReceipt {
  orderId: string;
  segmentId: string;
  paidAt: string;
  method: PaymentMethod;
  subtotal: number;
  fees: number;
  total: number;
  items: BudgetItem[];
}

export interface ItemConfirmationResult {
  itemId: string;
  status: 'confirmed' | 'failed';
  reason?: string;
  confirmationCode?: string;
}

// --- VIRTUAL GUIDE TYPES ---
export type GuideMode = 'camera' | 'backpack';
export interface GuideState {
  isActive: boolean;
  mode: GuideMode;
  isAudioPlaying: boolean;
  lastLocation?: { lat: number; lng: number };
}
