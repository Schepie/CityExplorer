export const GUIDE_STATES = {
    GREETING: 'GREETING',
    ASK_CITY: 'ASK_CITY',
    ASK_DURATION: 'ASK_DURATION',
    ASK_INTERESTS: 'ASK_INTERESTS',
    GENERATING: 'GENERATING',
    COMPLETED: 'COMPLETED',
};

const MOCK_POIS = {
    amsterdam: [
        { name: 'Dam Square', description: 'The historical center of the city.', lat: 52.3731, lng: 4.8922 },
        { name: 'Anne Frank House', description: 'Historical house dedicated to Jewish wartime diarist Anne Frank.', lat: 52.3752, lng: 4.8840 },
        { name: 'Rijksmuseum', description: 'Dutch national museum dedicated to arts and history.', lat: 52.3600, lng: 4.8852 },
        { name: 'Vondelpark', description: 'Public urban park of 47 hectares.', lat: 52.3580, lng: 4.8686 },
    ],
    paris: [
        { name: 'Eiffel Tower', description: 'Wrought-iron lattice tower on the Champ de Mars.', lat: 48.8584, lng: 2.2945 },
        { name: 'Louvre Museum', description: 'The world\'s largest art museum.', lat: 48.8606, lng: 2.3376 },
        { name: 'Notre-Dame', description: 'Medieval Catholic cathedral on the Île de la Cité.', lat: 48.8530, lng: 2.3499 },
    ],
    default: [
        { name: 'City Center', description: 'The vibrant heart of the city.', lat: 0, lng: 0 },
        { name: 'Central Park', description: 'A beautiful green space.', lat: 0.01, lng: 0.01 },
        { name: 'Historic Museum', description: 'Learn about the local history.', lat: -0.01, lng: -0.01 },
    ]
};

export const getNextStep = (currentState, userInput, context) => {
    const nextContext = { ...context };
    let response = '';
    let nextState = currentState;
    let action = null;

    switch (currentState) {
        case GUIDE_STATES.GREETING:
            response = "Hello! I am your personal City Guide. I can help you discover the most beautiful places with a personalized walking tour. Which city would you like to explore today?";
            nextState = GUIDE_STATES.ASK_CITY;
            break;

        case GUIDE_STATES.ASK_CITY:
            nextContext.city = userInput;
            response = `Excellent choice! ${userInput} is a wonderful city. roughly how long would you like the walk to be? (e.g., 2 hours, 5km)`;
            nextState = GUIDE_STATES.ASK_DURATION;
            break;

        case GUIDE_STATES.ASK_DURATION:
            nextContext.duration = userInput;
            response = "Noted. Finally, do you have any specific interests? (e.g., history, architecture, food, nature)";
            nextState = GUIDE_STATES.ASK_INTERESTS;
            break;

        case GUIDE_STATES.ASK_INTERESTS:
            nextContext.interests = userInput;
            response = "Perfect! I am designing a route specifically for you based on your preferences. Just a moment...";
            nextState = GUIDE_STATES.GENERATING;
            break;

        case GUIDE_STATES.GENERATING:
            // This state would auto-transition in the UI, but providing text here just in case.
            response = "Here is your personalized walking tour!";
            nextState = GUIDE_STATES.COMPLETED;
            // Generate Mock Route
            const cityKey = nextContext.city ? nextContext.city.toLowerCase() : 'default';
            const pois = MOCK_POIS[cityKey] || MOCK_POIS['default'];

            // Simple logic to just return all POIs for the demo
            action = {
                type: 'SHOW_ROUTE',
                payload: {
                    city: nextContext.city,
                    pois: pois,
                    summary: `Based on your interest in ${nextContext.interests}, I've selected a route that takes you through the highlights of ${nextContext.city}. You will visit ${pois.length} key locations, perfect for a ${nextContext.duration} walk.`
                }
            };
            break;

        default:
            response = "I'm not sure what to do next. Let's start over.";
            nextState = GUIDE_STATES.GREETING;
            break;
    }

    return { nextState, response, nextContext, action };
};
