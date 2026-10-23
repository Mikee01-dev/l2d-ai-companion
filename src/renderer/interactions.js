export function setupInteraction(model, app) {
    if (!model) return;

    window.addEventListener('mousemove', (e) => {
        const x = (e.clientX / window.innerWidth) * 2 - 1;
        const y = (e.clientY / window.innerHeight) * 2 - 1;

        const coreModel = model.internalModel.coreModel;

        coreModel.setParameterValueById('ParamAngleX', x * 30);
        coreModel.setParameterValueById('ParamAngleY', -y * 30);
        coreModel.setParameterValueById('ParamEyeBallX', x);
        coreModel.setParameterValueById('ParamEyeBallY', -y);
        coreModel.setParameterValueById('ParamBodyAngleX', x * 10);
    });

    function blink() {
        const coreModel = model.internalModel.coreModel;

        coreModel.setParameterValueById('ParamEyeLOpen', 0);
        coreModel.setParameterValueById('ParamEyeROpen', 0);

        setTimeout(() => {
            coreModel.setParameterValueById('ParamEyeLOpen', 1);
            coreModel.setParameterValueById('ParamEyeROpen', 1);
        }, 100);
    }

    setTimeout(blink, 2000);

    let breathTime = 0;
    app.ticker.add((ticker) => {
        breathTime += 0.02 * ticker.deltaTime;
        const breathValue = Math.sin(breathTime) * 0.5 + 0.5;
        model.internalModel.coreModel.setParameterValueById('ParamBreath', breathValue);
    });
}