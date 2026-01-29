
import React, { useState, useEffect } from 'react';
import { 
    FileText, Shield, Upload, Plus, X, Lock, Unlock, Trash2, 
    Eye, CheckCircle, AlertCircle, Loader2, Save, File 
} from 'lucide-react';
import { UserDocument, DocumentType } from '../types';
import { useDocuments } from '../contexts/DocumentContext'; // Use Context
import { simulateOCR } from '../services/documentService'; // Keep service for OCR util only

interface MyDocumentsProps {
  isOpen: boolean;
  onClose: () => void;
}

const DOCUMENT_TYPES: { type: DocumentType; label: string; icon: any }[] = [
  { type: 'passport', label: 'Passport', icon: Shield },
  { type: 'visa', label: 'Visa', icon: FileText },
  { type: 'id_card', label: 'ID Card', icon: FileText },
  { type: 'insurance', label: 'Insurance', icon: Shield },
  { type: 'ticket', label: 'Tickets', icon: File },
  { type: 'other', label: 'Other', icon: File },
];

const MyDocuments: React.FC<MyDocumentsProps> = ({ isOpen, onClose }) => {
  const { documents, addDocument, updateDocument, deleteDocument } = useDocuments(); // Context Hook
  const [view, setView] = useState<'list' | 'add'>('list');
  const [addMode, setAddMode] = useState<'manual' | 'upload' | null>(null);

  // Form State
  const [newDocType, setNewDocType] = useState<DocumentType>('passport');
  const [formData, setFormData] = useState<any>({});
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('list');
      setAddMode(null);
    }
  }, [isOpen]);

  const handleAddStart = () => {
    setView('add');
    setAddMode(null);
    setFormData({});
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setIsProcessing(true);
      try {
        const extracted = await simulateOCR(file, newDocType);
        setFormData({ ...extracted });
        setAddMode('manual'); // Switch to manual to review extracted data
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleSave = () => {
    if (!formData.title && !formData.fullName) {
        // Fallback title
        formData.title = `${DOCUMENT_TYPES.find(t => t.type === newDocType)?.label} - ${new Date().toLocaleDateString()}`;
    }

    const newDoc: UserDocument = {
      id: `doc-${Date.now()}`,
      type: newDocType,
      title: formData.title || formData.fullName || 'Untitled Document',
      source: addMode === 'upload' ? 'upload' : 'manual', // Logic simplified as we switched modes
      shareStatus: 'private', // Default private
      createdAt: new Date().toISOString(),
      data: formData
    };

    addDocument(newDoc); // Use Context
    setView('list');
  };

  const toggleShare = (doc: UserDocument) => {
    const newStatus = doc.shareStatus === 'private' ? 'shared' : 'private';
    
    // Simple consent check
    if (newStatus === 'shared') {
      const confirm = window.confirm("Allow OmniTrip AI to read this document to help autofill forms and recommendations?");
      if (!confirm) return;
    }

    updateDocument(doc.id, { shareStatus: newStatus }); // Use Context
  };

  const handleDelete = (id: string) => {
    if (window.confirm("Are you sure? This cannot be undone.")) {
      deleteDocument(id); // Use Context
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] bg-omni-dark/60 backdrop-blur-sm flex justify-end">
      <div className="w-full max-w-md h-full bg-white shadow-cartoon-lg border-l-4 border-omni-dark flex flex-col animate-in slide-in-from-right duration-300">
        
        {/* Header */}
        <div className="bg-omni-yellow p-6 border-b-4 border-omni-dark flex justify-between items-center">
          <h2 className="text-2xl font-black flex items-center gap-2">
            <FileText className="text-omni-dark" /> MY DOCS 🗂️
          </h2>
          <button onClick={onClose} className="w-10 h-10 bg-white rounded-full border-2 border-omni-dark flex items-center justify-center hover:bg-gray-100">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50 p-6 custom-scrollbar">
          
          {view === 'list' && (
            <>
              {documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center opacity-60">
                   <Shield size={64} className="text-gray-300 mb-4" />
                   <p className="font-black text-gray-400">No documents yet.</p>
                   <p className="text-xs font-bold text-gray-400 max-w-[200px]">Store your passports & tickets securely here!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map(doc => {
                    const TypeIcon = DOCUMENT_TYPES.find(t => t.type === doc.type)?.icon || File;
                    return (
                      <div key={doc.id} className="bg-white p-4 rounded-2xl border-4 border-omni-dark shadow-cartoon-sm flex flex-col gap-3">
                         <div className="flex justify-between items-start">
                            <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-gray-100 rounded-xl border-2 border-omni-dark flex items-center justify-center">
                                  <TypeIcon size={20} className="text-omni-dark" />
                                </div>
                                <div>
                                    <h4 className="font-black text-sm">{doc.title}</h4>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">{doc.type} • {new Date(doc.createdAt).toLocaleDateString()}</p>
                                </div>
                            </div>
                            <button onClick={() => handleDelete(doc.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                                <Trash2 size={16} />
                            </button>
                         </div>
                         
                         {/* Data Preview */}
                         <div className="bg-gray-50 p-2 rounded-lg border border-gray-200 text-xs font-mono text-gray-600 truncate">
                            {Object.values(doc.data).filter(v => typeof v === 'string').join(', ') || 'No details'}
                         </div>

                         {/* Share Toggle */}
                         <div className="flex items-center justify-between pt-2 border-t-2 border-dashed border-gray-100">
                             <div className="flex items-center gap-2">
                                 {doc.shareStatus === 'shared' ? (
                                     <Unlock size={14} className="text-omni-green" />
                                 ) : (
                                     <Lock size={14} className="text-gray-400" />
                                 )}
                                 <span className={`text-[10px] font-black uppercase ${doc.shareStatus === 'shared' ? 'text-omni-green' : 'text-gray-400'}`}>
                                     {doc.shareStatus === 'shared' ? 'Shared with AI' : 'Private'}
                                 </span>
                             </div>
                             <button 
                                onClick={() => toggleShare(doc)}
                                className={`px-3 py-1 rounded-lg border-2 text-[10px] font-black transition-all ${
                                    doc.shareStatus === 'shared' 
                                    ? 'bg-omni-green border-omni-dark' 
                                    : 'bg-white border-gray-300 hover:bg-gray-100'
                                }`}
                             >
                                 {doc.shareStatus === 'shared' ? 'ON' : 'OFF'}
                             </button>
                         </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {view === 'add' && (
            <div className="space-y-6 animate-in slide-in-from-right">
                {/* 1. Select Type */}
                {!addMode && (
                    <>
                        <p className="font-black text-sm uppercase text-gray-400 text-center mb-2">Select Document Type</p>
                        <div className="grid grid-cols-2 gap-3">
                            {DOCUMENT_TYPES.map(t => (
                                <button 
                                    key={t.type}
                                    onClick={() => { setNewDocType(t.type); setAddMode('manual'); }} // Defaulting to manual for flow simplicity after type select
                                    className={`p-4 rounded-xl border-4 transition-all flex flex-col items-center gap-2 ${newDocType === t.type ? 'bg-omni-blue border-omni-dark shadow-cartoon-sm' : 'bg-white border-gray-200 hover:bg-gray-50'}`}
                                >
                                    <t.icon size={24} />
                                    <span className="font-black text-xs">{t.label}</span>
                                </button>
                            ))}
                        </div>
                        
                        <div className="relative my-4">
                             <div className="absolute inset-0 flex items-center"><div className="w-full border-t-2 border-gray-200"></div></div>
                             <div className="relative flex justify-center text-xs"><span className="px-2 bg-gray-50 text-gray-400 font-bold uppercase">Actions</span></div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <label className="flex flex-col items-center justify-center p-6 bg-white border-4 border-dashed border-omni-dark rounded-2xl cursor-pointer hover:bg-omni-yellow/20 transition-colors">
                                <Upload size={32} className="text-gray-400 mb-2" />
                                <span className="font-black text-xs">UPLOAD SCAN</span>
                                <input type="file" className="hidden" accept="image/*,.pdf" onChange={handleUpload} />
                            </label>
                            <button 
                                onClick={() => setAddMode('manual')}
                                className="flex flex-col items-center justify-center p-6 bg-white border-4 border-omni-dark rounded-2xl hover:bg-omni-blue/20 transition-colors shadow-cartoon-sm"
                            >
                                <Plus size={32} className="text-gray-400 mb-2" />
                                <span className="font-black text-xs">ENTER MANUAL</span>
                            </button>
                        </div>
                    </>
                )}

                {/* 2. Manual Form / Review */}
                {addMode === 'manual' && (
                    <div className="space-y-4">
                        <div className="bg-white p-4 rounded-2xl border-4 border-omni-dark shadow-cartoon-sm">
                            <h3 className="font-black text-lg mb-4 flex items-center gap-2">
                                {isProcessing ? <Loader2 className="animate-spin" /> : <FileText />}
                                {isProcessing ? 'Scanning...' : 'Document Details'}
                            </h3>
                            
                            <div className="space-y-3">
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Title / Name</label>
                                    <input 
                                        className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold text-sm"
                                        placeholder="e.g. My Passport"
                                        value={formData.title || formData.fullName || ''}
                                        onChange={e => setFormData({...formData, title: e.target.value})}
                                    />
                                </div>
                                {newDocType === 'passport' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Passport Number</label>
                                            <input 
                                                className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold text-sm"
                                                value={formData.passportNumber || ''}
                                                onChange={e => setFormData({...formData, passportNumber: e.target.value})}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Nationality</label>
                                            <input 
                                                className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold text-sm"
                                                value={formData.nationality || ''}
                                                onChange={e => setFormData({...formData, nationality: e.target.value})}
                                            />
                                        </div>
                                    </>
                                )}
                                <div>
                                    <label className="text-[10px] font-black uppercase text-gray-400 ml-1">Notes</label>
                                    <textarea 
                                        className="w-full p-3 border-2 border-omni-dark rounded-xl font-bold text-sm"
                                        rows={3}
                                        value={formData.notes || ''}
                                        onChange={e => setFormData({...formData, notes: e.target.value})}
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => { setView('add'); setAddMode(null); }} className="flex-1 py-3 font-bold text-gray-400">Back</button>
                            <button onClick={handleSave} className="flex-1 bg-omni-green py-3 rounded-xl border-2 border-omni-dark font-black shadow-cartoon-sm active:translate-y-1">SAVE DOC</button>
                        </div>
                    </div>
                )}
            </div>
          )}

        </div>

        {/* Footer Actions */}
        {view === 'list' && (
            <div className="p-6 bg-gray-50 border-t-4 border-omni-dark">
                 <button 
                    onClick={handleAddStart}
                    className="w-full py-4 bg-omni-yellow rounded-2xl border-4 border-omni-dark font-black text-lg shadow-cartoon hover:bg-yellow-300 active:translate-y-1 transition-all flex items-center justify-center gap-2"
                >
                    <Plus size={24} /> ADD DOCUMENT
                </button>
                <p className="text-[10px] text-center text-gray-400 font-bold mt-2 uppercase">Stored on device • You control sharing</p>
            </div>
        )}
      </div>
    </div>
  );
};

export default MyDocuments;
