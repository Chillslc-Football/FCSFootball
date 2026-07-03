import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  DEFAULT_CONFERENCE_ID,
  type ConferenceId,
} from '@/data/conferences/conferenceList';

type SelectedConferenceContextValue = {
  selectedConference: ConferenceId;
  setSelectedConference: (id: ConferenceId) => void;
};

const SelectedConferenceContext = createContext<SelectedConferenceContextValue | null>(null);

export function SelectedConferenceProvider({ children }: { children: ReactNode }) {
  const [selectedConference, setSelectedConference] =
    useState<ConferenceId>(DEFAULT_CONFERENCE_ID);

  const value = useMemo(
    () => ({ selectedConference, setSelectedConference }),
    [selectedConference],
  );

  return (
    <SelectedConferenceContext.Provider value={value}>
      {children}
    </SelectedConferenceContext.Provider>
  );
}

export function useSelectedConference(): SelectedConferenceContextValue {
  const context = useContext(SelectedConferenceContext);
  if (!context) {
    throw new Error('useSelectedConference must be used within SelectedConferenceProvider');
  }
  return context;
}
