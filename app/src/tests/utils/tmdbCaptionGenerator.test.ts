import { describe, expect, it } from 'vitest';
import { __tmdbCaptionSanitizer } from '../../utils/tmdbCaptionGenerator';

describe('tmdb caption sanitizer', () => {
  it('removes malformed markdown source links and raw domain fragments', () => {
    const input = "‘Parish’ turns 2 years old today—released 2 years ago today as Giancarlo Esposito led the crime-drama cast alongside Zakary Momoh and Paula Malcomson. 🎬 ([amcnetworks.com](amcnetworks.com/press-releases...";

    const output = __tmdbCaptionSanitizer.stripCaptionLinks(input);

    expect(output).toContain('Parish');
    expect(output).not.toContain('amcnetworks.com');
    expect(output).not.toContain('press-releases');
    expect(output).not.toContain('](');
    expect(output.trim().endsWith('(')).toBe(false);
  });
});
