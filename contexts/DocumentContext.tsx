
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserDocument, AutofillProfile } from '../types';

interface DocumentContextType {
  documents: UserDocument[];
  addDocument: (doc: UserDocument) => void;
  updateDocument: (id: string, updates: Partial<UserDocument>) => void;
  deleteDocument: (id: string) => void;
  // Extractor
  getAutofillProfile: () => AutofillProfile | null;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

const STORAGE_KEY = 'omnitrip_user_documents';

export const DocumentProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<UserDocument[]>([]);

  // Load on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setDocuments(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load docs", e);
    }
  }, []);

  // Persist on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  const addDocument = (doc: UserDocument) => {
    setDocuments(prev => [doc, ...prev]);
  };

  const updateDocument = (id: string, updates: Partial<UserDocument>) => {
    setDocuments(prev => prev.map(doc => doc.id === id ? { ...doc, ...updates } : doc));
  };

  const deleteDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  /**
   * Deterministic extraction of the "Best" profile for autofill.
   * 1. Filters for SHARED documents only.
   * 2. Prioritizes 'passport' type.
   * 3. Sorts by createdAt (newest first) to get latest data.
   */
  const getAutofillProfile = (): AutofillProfile | null => {
    // Only look at shared docs
    const sharedDocs = documents.filter(d => d.shareStatus === 'shared');
    
    // Find best passport
    const passports = sharedDocs.filter(d => d.type === 'passport');
    // Sort desc by creation
    passports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const primaryDoc = passports.length > 0 ? passports[0] : null;

    if (primaryDoc && primaryDoc.data.passportNumber) {
      return {
        fullName: primaryDoc.data.fullName || '',
        passportNumber: primaryDoc.data.passportNumber,
        nationality: primaryDoc.data.nationality || 'United States',
        dateOfBirth: primaryDoc.data.dateOfBirth || '',
        expiryDate: primaryDoc.data.expiryDate,
        sourceDocId: primaryDoc.id
      };
    }
    return null;
  };

  return (
    <DocumentContext.Provider value={{ documents, addDocument, updateDocument, deleteDocument, getAutofillProfile }}>
      {children}
    </DocumentContext.Provider>
  );
};

export const useDocuments = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
};
