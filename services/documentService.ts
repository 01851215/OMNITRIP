
import { UserDocument, DocumentType, DocumentSource, AutofillProfile } from '../types';

const STORAGE_KEY = 'omnitrip_user_documents';

/**
 * Loads all documents from local storage.
 */
export const loadDocuments = (): UserDocument[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to load documents", e);
    return [];
  }
};

/**
 * Saves the document list to local storage.
 */
const persist = (docs: UserDocument[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
  } catch (e) {
    console.error("Failed to save documents", e);
  }
};

/**
 * Adds a new document.
 */
export const addDocument = (doc: UserDocument): UserDocument[] => {
  const current = loadDocuments();
  const updated = [doc, ...current];
  persist(updated);
  return updated;
};

/**
 * Updates an existing document (e.g. toggling share status).
 */
export const updateDocument = (id: string, updates: Partial<UserDocument>): UserDocument[] => {
  const current = loadDocuments();
  const updated = current.map(doc => doc.id === id ? { ...doc, ...updates } : doc);
  persist(updated);
  return updated;
};

/**
 * Deletes a document.
 */
export const deleteDocument = (id: string): UserDocument[] => {
  const current = loadDocuments();
  const updated = current.filter(doc => doc.id !== id);
  persist(updated);
  return updated;
};

/**
 * Simulates an OCR scan of an uploaded image/PDF.
 * Returns inferred fields based on random chance for the prototype.
 */
export const simulateOCR = async (file: File, type: DocumentType): Promise<Partial<UserDocument['data']>> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      // Mock Data Extraction
      if (type === 'passport') {
        resolve({
          fullName: "Alex Traveler",
          passportNumber: "A" + Math.floor(Math.random() * 10000000),
          nationality: "United States",
          dateOfBirth: "1995-06-15",
          expiryDate: "2030-01-01",
          fileName: file.name
        });
      } else {
        resolve({
          notes: "Scanned from image",
          fileName: file.name
        });
      }
    }, 2000); // 2 second delay
  });
};

/**
 * Helper for other modules to get the "Best Available" passport profile
 * from SHARED documents only.
 */
export const getPassportProfileFromDocs = (): AutofillProfile | null => {
  const docs = loadDocuments();
  const passport = docs.find(d => d.type === 'passport' && d.shareStatus === 'shared');
  
  if (passport && passport.data.passportNumber) {
    return {
      fullName: passport.data.fullName || '',
      passportNumber: passport.data.passportNumber,
      nationality: passport.data.nationality || 'United States',
      dateOfBirth: passport.data.dateOfBirth || '',
      expiryDate: passport.data.expiryDate,
      sourceDocId: passport.id
    };
  }
  return null;
};
