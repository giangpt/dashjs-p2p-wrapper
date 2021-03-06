import TrackView from './TrackView';

class PlayerInterface {

    constructor (player, manifestHelper, liveDelay) {
        this._player = player;
        this._manifestHelper = manifestHelper;
        this._liveDelay = liveDelay;

        this.MIN_BUFFER_LEVEL = 10;
        this._bufferLevelMax = Math.max(0, this._liveDelay - this.MIN_BUFFER_LEVEL);

        this._listeners = new Map();

        this._onStreamInitialized = this._dispatchInitialOnTrackChange.bind(this);
        this._player.on(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this._onStreamInitialized);
    }

    dispose() {
        this._player.off(dashjs.MediaPlayer.events.STREAM_INITIALIZED, this._onStreamInitialized);
    }

    isLive () {
        return this._manifestHelper.isLive();
    }

    getBufferLevelMax () {
        return this._bufferLevelMax;
    }

    setBufferMarginLive(bufferLevel) {
        let safeBufferLevel = bufferLevel;
        if (safeBufferLevel > this._bufferLevelMax) {
            safeBufferLevel = this._bufferLevelMax;
            console.info("setBufferMarginLive(): buffer level from tracker was capped to=", safeBufferLevel);
        }

        this._dashjsBufferTime = this.MIN_BUFFER_LEVEL + safeBufferLevel;
        this._player.setStableBufferTime(this._dashjsBufferTime);
        this._player.setBufferTimeAtTopQuality(this._dashjsBufferTime);
        this._player.setBufferTimeAtTopQualityLongForm(this._dashjsBufferTime); // TODO: can live be "long form" ?
    }

    addEventListener (eventName, observer) {
        if (eventName !== "onTrackChange") {
            return;  // IMPORTANT: we need to return to avoid errors in _dispatchInitialOnTrackChange
        }

        var onTrackChangeListener = this._createOnTrackChangeListener(observer);
        this._listeners.set(observer, onTrackChangeListener);

        this._player.on('qualityChanged', onTrackChangeListener); // TODO: hardcoded event name. Get it from enum
    }

    removeEventListener(eventName, observer) {
        if (eventName !== "onTrackChange") {
            return;
        }

        var onTrackChangeListener = this._listeners.get(observer);

        this._player.off('qualityChanged', onTrackChangeListener); // TODO: hardcoded event name. Get it from enum

        this._listeners.delete(observer);
    }

    _createOnTrackChangeListener (observer) {
        let player = this._player;

        return function({ mediaType, streamInfo, newQuality}) {
            var tracks = {};
            tracks[mediaType] = new TrackView({
                periodId: streamInfo.index,
                adaptationSetId: player.getCurrentTrackFor(mediaType).index,
                representationId: Number(newQuality)
            });

            observer(tracks);
        };
    }

    _dispatchInitialOnTrackChange () {
        let tracks = this._manifestHelper.getCurrentTracks();
        for (let observer of this._listeners.keys()) {
            observer(tracks);
        }
    }

}

export default PlayerInterface;
