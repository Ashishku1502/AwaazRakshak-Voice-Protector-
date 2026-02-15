const StateMachine = require('../agent/stateMachine');
const Session = require('../../database/models/Session');
const floodProtocol = require('../protocols/flood.json');
const earthquakeProtocol = require('../protocols/earthquake.json');
const { getStatus } = require('../database/connection');

const memorySessions = new Map();

module.exports = (io) => {
    io.on('connection', async (socket) => {
        const persistentId = socket.handshake.auth.persistentId || socket.id;
        console.log('Client connected:', socket.id, 'Persistent ID:', persistentId);

        let agent = new StateMachine();
        const dbActive = getStatus();

        try {
            if (dbActive) {
                const savedSession = await Session.findOne({ sessionId: persistentId });
                if (savedSession) {
                    const sessionData = savedSession.toObject();
                    delete sessionData._id;
                    delete sessionData.__v;
                    agent.state = { ...agent.state, ...sessionData };
                    console.log(`✅ Recovered session (DB) for ${persistentId}`);
                } else {
                    await Session.create({ sessionId: persistentId, ...agent.state });
                    console.log(`🆕 Created new session (DB) for ${persistentId}`);
                }
            } else {
                if (memorySessions.has(persistentId)) {
                    agent.state = memorySessions.get(persistentId);
                    console.log(`✅ Recovered session (Memory) for ${persistentId}`);
                } else {
                    memorySessions.set(persistentId, agent.state);
                    console.log(`🆕 Created new session (Memory) for ${persistentId}`);
                }
            }
        } catch (err) {
            console.error("❌ Session initialization error:", err);
        }

        socket.on('voice_transcript', async (data) => {
            const { transcript, location } = data;
            console.log(`Transcript from ${persistentId}: ${transcript}`);

            if (location) {
                agent.updateState({ location });
            }

            // 1. Detect Panic
            agent.detectPanic(transcript);

            // 2. Determine Disaster Type if not already set
            if (!agent.state.disasterType) {
                agent.determineDisasterType(transcript);
            }

            // 3. Generate Response
            let responseText = "";
            const protocol = agent.state.disasterType === 'flood' ? floodProtocol :
                agent.state.disasterType === 'earthquake' ? earthquakeProtocol : null;

            if (agent.state.emotionalState === 'panic') {
                responseText = "Stay calm. I am here to help. ";
            }

            if (protocol) {
                const nextStep = agent.getNextInstruction(protocol);
                responseText += nextStep;
            } else {
                responseText += "I'm listening. Tell me what's happening around you. Are you experiencing a flood or an earthquake?";
            }

            // 4. Update Persistence
            try {
                if (dbActive) {
                    await Session.findOneAndUpdate(
                        { sessionId: persistentId },
                        { ...agent.state },
                        { upsert: true }
                    );
                } else {
                    memorySessions.set(persistentId, agent.state);
                }
            } catch (err) {
                console.error("Session update error:", err);
            }

            // 5. Send response back to frontend
            socket.emit('voice_response', {
                text: responseText,
                state: agent.state
            });
        });

        socket.on('volume_spike', async (data) => {
            console.log(`Volume spike reported by ${persistentId}: ${data.level}`);
            agent.updateState({ emotionalState: 'panic', urgencyLevel: 'high' });

            if (dbActive) {
                await Session.findOneAndUpdate({ sessionId: persistentId }, { ...agent.state });
            } else {
                memorySessions.set(persistentId, agent.state);
            }

            socket.emit('voice_response', {
                text: "I heard a loud noise. Stay calm, I am here. Are you safe?",
                state: agent.state
            });
        });

        socket.on('internet_status', (data) => {
            agent.updateState({ internetStatus: data.status });
            console.log(`Client ${persistentId} status: ${data.status}`);
        });

        socket.on('agent_reset', async () => {
            agent.reset();
            if (dbActive) {
                await Session.findOneAndUpdate({ sessionId: persistentId }, { ...agent.state });
            } else {
                memorySessions.set(persistentId, agent.state);
            }
            socket.emit('voice_response', {
                text: "Agent state has been reset. How can I help you?",
                state: agent.state
            });
            console.log(`Agent reset for client ${persistentId}`);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected:', socket.id, 'Persistent ID:', persistentId);
        });
    });
};
