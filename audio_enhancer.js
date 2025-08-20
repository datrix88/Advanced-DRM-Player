class AudioEnhancer {
    constructor(videoElement) {
        if (!window.AudioContext) {
            this.isSupported = false;
            return;
        }
        this.isSupported = true;
        this.isEnabled = false;
        this.videoElement = videoElement;
        this.audioContext = new AudioContext();
        this.sourceNode = this.audioContext.createMediaElementSource(this.videoElement);
        
        this.preamp = this.audioContext.createGain();
        this.compressor = this.audioContext.createDynamicsCompressor();
        this.bandFrequencies = [60, 170, 310, 600, 1000, 3000, 6000, 12000, 14000, 16000];
        this.filters = this.bandFrequencies.map(freq => {
            const filter = this.audioContext.createBiquadFilter();
            filter.type = 'peaking';
            filter.frequency.value = freq;
            filter.Q.value = 1.41;
            filter.gain.value = 0;
            return filter;
        });

        this.connectNodes();
    }

    connectNodes() {
        this.sourceNode.disconnect();
        if (this.isEnabled) {
            let lastNode = this.preamp;
            this.sourceNode.connect(this.preamp);
            this.filters.forEach(filter => {
                lastNode.connect(filter);
                lastNode = filter;
            });
            lastNode.connect(this.compressor);
            this.compressor.connect(this.audioContext.destination);
        } else {
            this.sourceNode.connect(this.audioContext.destination);
        }
    }

    toggle(state) {
        this.isEnabled = state;
        this.connectNodes();
    }
    
    setCompressor(settings) {
        if (!this.isSupported || !settings) return;
        this.compressor.threshold.value = settings.threshold || -24;
        this.compressor.knee.value = settings.knee || 30;
        this.compressor.ratio.value = settings.ratio || 12;
        this.compressor.attack.value = settings.attack || 0.003;
        this.compressor.release.value = settings.release || 0.25;
    }

    changeGain(bandIndex, gainValue) {
        if (!this.isSupported || bandIndex < 0 || bandIndex >= this.filters.length) return;
        this.filters[bandIndex].gain.value = gainValue;
    }

    changePreamp(gainValue) {
        if (!this.isSupported) return;
        const linearValue = Math.pow(10, gainValue / 20);
        this.preamp.gain.value = linearValue;
    }

    applySettings(settings) {
        if (!this.isSupported || !settings) return;
        
        this.toggle(settings.enabled);

        if (typeof settings.preamp === 'number') {
            this.changePreamp(settings.preamp);
        }
        
        if (Array.isArray(settings.bands)) {
            settings.bands.forEach((gain, index) => {
                this.changeGain(index, gain);
            });
        }
        
        if (settings.compressor) {
             this.setCompressor(settings.compressor);
        } else {
             this.setCompressor({});
        }
    }
    
    getSettings() {
        if (!this.isSupported) return { enabled: false, preamp: 0, bands: new Array(10).fill(0), customPresets: [] };
        const preampDB = 20 * Math.log10(this.preamp.gain.value);
        const bandGains = this.filters.map(filter => filter.gain.value);
        return { enabled: this.isEnabled, preamp: preampDB, bands: bandGains };
    }

    destroy() {
        if (!this.isSupported) return;
        try {
            this.sourceNode.disconnect();
            this.preamp.disconnect();
            this.compressor.disconnect();
            this.filters.forEach(filter => filter.disconnect());
            if (this.audioContext.state !== 'closed') {
                this.audioContext.close();
            }
        } catch (e) {
            console.error("Error al destruir AudioEnhancer:", e);
        }
    }
}