let mouthInterval = null;

export function animateMouth(model, duration) {
    if (!model) return;
    
    if (mouthInterval) clearInterval(mouthInterval);
    
    const coreModel = model.internalModel.coreModel;
    const startTime = Date.now();
    
    mouthInterval = setInterval(() => {
        if (Date.now() - startTime > duration) {
            clearInterval(mouthInterval);
            mouthInterval = null;
            coreModel.setParameterValueById('ParamMouthOpenY', 0);
            return;
        }
        
        const randomOpen = Math.random() * 0.8; 
        coreModel.setParameterValueById('ParamMouthOpenY', randomOpen);
    }, 50);
}