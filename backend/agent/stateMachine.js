class StateMachine {
    constructor() {
        this.state = {
            disasterType: null,
            urgencyLevel: 'low',
            emotionalState: 'calm',
            currentStep: 0,
            internetStatus: 'online',
            location: { lat: null, lng: null },
            environmentFlags: {
                waterLevel: null,
                shaking: false,
                gasSmell: false,
                injuryDetected: false
            },
            firstAidGiven: false
        };
    }

    updateState(updates) {
        this.state = { ...this.state, ...updates };
        return this.state;
    }

    detectPanic(transcript) {
        const panicWords = ["help", "fast", "trapped", "water rising", "shaking", "dying", "emergency", "panic", "scared", "please"];
        const transcriptLower = transcript.toLowerCase();
        const isPanic = panicWords.some(word => transcriptLower.includes(word));

        if (isPanic) {
            this.state.emotionalState = 'panic';
            this.state.urgencyLevel = 'high';
        }

        return isPanic;
    }

    determineDisasterType(transcript) {
        const transcriptLower = transcript.toLowerCase();

        // Detailed Flags Detection
        if (transcriptLower.includes('water') || transcriptLower.includes('flood') || transcriptLower.includes('rising')) {
            this.state.environmentFlags.waterLevel = 'rising';
            this.state.disasterType = 'flood';
        }

        if (transcriptLower.includes('shaking') || transcriptLower.includes('earthquake') || transcriptLower.includes('ground moved') || transcriptLower.includes('tremor')) {
            this.state.environmentFlags.shaking = true;
            this.state.disasterType = 'earthquake';
        }

        if (transcriptLower.includes('gas') || transcriptLower.includes('smell') || transcriptLower.includes('leak')) {
            this.state.environmentFlags.gasSmell = true;
        }

        if (transcriptLower.includes('hurt') || transcriptLower.includes('injured') || transcriptLower.includes('bleeding') || transcriptLower.includes('wound')) {
            this.state.environmentFlags.injuryDetected = true;
        }

        if (this.state.disasterType) {
            this.state.urgencyLevel = 'high';
        }

        return this.state.disasterType;
    }

    getNextInstruction(protocol) {
        if (!protocol) return "I'm not sure which protocol to follow. Are you in a flood or an earthquake?";

        // 1. Priority Hazard Overrides
        if (this.state.environmentFlags.gasSmell) {
            return "CRITICAL: I detected a possible gas leak. Do not use matches, light switches, or any electronics. Get to fresh air immediately.";
        }

        if (this.state.environmentFlags.injuryDetected && !this.state.firstAidGiven) {
            this.state.firstAidGiven = true;
            return "I've registered a medical emergency. Apply firm pressure to any bleeding wounds using a clean cloth. Help is being prioritized for your location.";
        }

        // 2. Sequential Protocol Steps
        if (this.state.currentStep < protocol.length) {
            const instruction = protocol[this.state.currentStep];
            this.state.currentStep++;
            return instruction;
        }

        // 3. Post-Protocol Wait
        return "You have completed all immediate safety steps. Stay where you are, keep your phone's battery saved, and wait for professional rescue teams. I am still monitoring your situation.";
    }

    reset() {
        this.state = {
            disasterType: null,
            urgencyLevel: 'low',
            emotionalState: 'calm',
            currentStep: 0,
            internetStatus: this.state.internetStatus, // Preserve internet status
            location: this.state.location, // Preserve location
            environmentFlags: {
                waterLevel: null,
                shaking: false,
                gasSmell: false,
                injuryDetected: false
            },
            firstAidGiven: false
        };
    }
}

module.exports = StateMachine;
