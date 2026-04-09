import { useState, useEffect } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { fetchPinterestBoards, PinterestBoard } from '../../lib/api/pinterest';
import { haptics } from '../../utils/haptics';
import { RedSpinner } from '../PageLoader';

interface PinterestBoardSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  id?: string;
}

export function PinterestBoardSelect({
  value,
  onChange,
  placeholder = 'Select a board',
  className,
  id,
}: PinterestBoardSelectProps) {
  const [boards, setBoards] = useState<PinterestBoard[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadBoards() {
      setIsLoading(true);
      const fetchedBoards = await fetchPinterestBoards();
      if (cancelled) {
        return;
      }
      setBoards(fetchedBoards);
      setIsLoading(false);
    }

    void loadBoards();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Select
      value={value}
      onValueChange={(newValue) => {
        haptics.light();
        onChange(newValue);
      }}
    >
      <SelectTrigger
        id={id}
        className={className || 'bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333333] text-gray-900 dark:text-white mt-1'}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="max-h-[300px]">
        {isLoading ? (
          <SelectItem value="loading" disabled>
            <div className="flex w-full items-center justify-center py-1">
              <RedSpinner size="sm" label="Loading Pinterest boards..." />
            </div>
          </SelectItem>
        ) : boards.length === 0 ? (
          <SelectItem value="no-boards" disabled>
            No boards found
          </SelectItem>
        ) : (
          boards.map((board) => (
            <SelectItem key={board.id} value={board.name}>
              <div className="flex items-center justify-between w-full">
                <span>{board.name}</span>
                {board.pin_count !== undefined && (
                  <span className="text-xs text-gray-500 dark:text-[#6B7280] ml-2">
                    ({board.pin_count} pins)
                  </span>
                )}
              </div>
            </SelectItem>
          ))
        )}
      </SelectContent>
    </Select>
  );
}
