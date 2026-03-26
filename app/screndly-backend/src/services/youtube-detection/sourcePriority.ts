export function getSourcePriorityScore(channelName: string, trustedChannel: boolean): number {
    const normalized = channelName.toLowerCase();

    if (/\b(warner bros|universal pictures|sony pictures|paramount pictures|lionsgate|amazon mgm|netflix|apple tv\+|disney\+|hulu|max|hbo)\b/.test(normalized)) {
        return trustedChannel ? 100 : 90;
    }

    if (trustedChannel) {
        return 80;
    }

    if (/\b(official|studios?|pictures|films|entertainment)\b/.test(normalized)) {
        return 70;
    }

    if (/\b(hollywood reporter|variety|deadline|ign|gamespot|fandango)\b/.test(normalized)) {
        return 60;
    }

    return 40;
}
