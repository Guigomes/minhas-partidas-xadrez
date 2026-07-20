export type MatchResult = 'win' | 'loss' | 'draw';
export type MatchColor = 'white' | 'black';

export type Match = {
  id: string;
  date: string;
  opponent: string;
  result: MatchResult;
  color: MatchColor;
  time_control: string | null;
  opening: string | null;
  notes: string | null;
  created_at: string;
};

export type MatchFormValues = {
  date: string;
  opponent: string;
  result: MatchResult;
  color: MatchColor;
  time_control?: string;
  opening?: string;
  notes?: string;
};
