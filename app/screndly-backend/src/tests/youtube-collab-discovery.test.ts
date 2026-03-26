import test from 'node:test';
import assert from 'node:assert/strict';
import {
    extractCollaboratorMetadata,
    hasStructuredSearchCollaboratorSignal,
    isExplicitCollaboratorForTrackedChannel,
    isRegionalFamilyChannelAssociation,
} from '../services/youtube-detection/collabDiscovery';

test('detects explicit collaborator from creators metadata', () => {
    const raw = {
        channel_id: 'UC_HARRY',
        channel: 'Harry Potter',
        creators: [
            { name: 'HBO Max', url: 'https://www.youtube.com/channel/UC_HBO' },
        ],
    };

    const metadata = extractCollaboratorMetadata(raw);
    assert.equal(metadata.isCollaborativePost, true);
    assert.deepEqual(metadata.collaboratorChannelNames, ['HBO Max']);
    assert.equal(
        isExplicitCollaboratorForTrackedChannel({ channelId: 'UC_HBO', name: 'HBO Max' }, raw),
        true
    );
});

test('does not treat title or description mention as collaborator', () => {
    const raw = {
        channel_id: 'UC_HARRY',
        channel: 'Harry Potter',
        title: 'Harry Potter Trailer with HBO Max mention',
        description: 'Presented with HBO Max',
        creators: null,
    };

    assert.equal(
        isExplicitCollaboratorForTrackedChannel({ channelId: 'UC_HBO', name: 'HBO Max' }, raw),
        false
    );
});

test('does not treat primary owner as collaborator discovery', () => {
    const raw = {
        channel_id: 'UC_HBO',
        channel: 'HBO Max',
        creators: [
            { name: 'HBO Max', url: 'https://www.youtube.com/channel/UC_HBO' },
            { name: 'Harry Potter', url: 'https://www.youtube.com/channel/UC_HARRY' },
        ],
    };

    assert.equal(
        isExplicitCollaboratorForTrackedChannel({ channelId: 'UC_HBO', name: 'HBO Max' }, raw),
        false
    );
});

test('accepts structured search collaborator result with channel and 2 more', () => {
    assert.equal(
        hasStructuredSearchCollaboratorSignal('HBO Max', {
            channel: 'HBO Max and 2 more',
            uploader: 'HBO Max and 2 more',
        }),
        true
    );
});

test('accepts official regional family channel association', () => {
    assert.equal(
        isRegionalFamilyChannelAssociation(
            { channelId: 'UC_HBO', name: 'HBO Max' },
            {
                channel_id: 'UC_HBO_NORDIC',
                channel: 'HBO Max Nordic',
            }
        ),
        true
    );
});

test('does not accept unrelated similar brand channel as family association', () => {
    assert.equal(
        isRegionalFamilyChannelAssociation(
            { channelId: 'UC_HBO', name: 'HBO Max' },
            {
                channel_id: 'UC_FAKE',
                channel: 'HBO Max Recaps',
            }
        ),
        false
    );
});
