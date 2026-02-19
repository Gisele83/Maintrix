export interface PhysicsModelResult {
  modelName: string;
  equipmentType: string;
  predictedBehavior: string;
  deviationFromNormal: number;
  physicalExplanation: string;
  confidence: number;
  parameters: Record<string, number>;
  remainingUsefulLife?: number;
}

export class ThermoMechanicalModel {
  predictBearingLife(params: {
    temperature: number;
    vibration: number;
    speed: number;
    load: number;
    operatingHours: number;
    bearingType?: string;
  }): PhysicsModelResult {
    const { temperature, vibration, speed, load, operatingHours } = params;

    const baseLifeHours = 20000;
    const tempFactor = temperature > 70 ? Math.exp(-0.03 * (temperature - 70)) : 1.0;
    const vibrationFactor = vibration > 4.5 ? Math.exp(-0.1 * (vibration - 4.5)) : 1.0;
    const speedFactor = speed > 3000 ? 0.8 : 1.0;
    const loadFactor = load > 80 ? Math.exp(-0.02 * (load - 80)) : 1.0;

    const adjustedLife = baseLifeHours * tempFactor * vibrationFactor * speedFactor * loadFactor;
    const remainingLife = Math.max(0, adjustedLife - operatingHours);
    const wearPercentage = Math.min(100, (operatingHours / adjustedLife) * 100);
    const deviation = wearPercentage / 100;

    let explanation = `Bearing wear analysis: ${wearPercentage.toFixed(1)}% of estimated life consumed.`;
    if (tempFactor < 0.9) explanation += ` High temperature (${temperature}°C) accelerates degradation by ${((1 - tempFactor) * 100).toFixed(0)}%.`;
    if (vibrationFactor < 0.9) explanation += ` Excessive vibration (${vibration} mm/s) reduces bearing life by ${((1 - vibrationFactor) * 100).toFixed(0)}%.`;

    return {
      modelName: 'Bearing Life Prediction (ISO 281)',
      equipmentType: 'rotating_machinery',
      predictedBehavior: wearPercentage > 80 ? 'Imminent failure' : wearPercentage > 60 ? 'Advanced degradation' : wearPercentage > 40 ? 'Normal wear' : 'Good condition',
      deviationFromNormal: deviation,
      physicalExplanation: explanation,
      confidence: 0.85,
      parameters: { tempFactor, vibrationFactor, speedFactor, loadFactor, wearPercentage },
      remainingUsefulLife: remainingLife
    };
  }

  predictPumpCavitation(params: {
    inletPressure: number;
    outletPressure: number;
    flowRate: number;
    temperature: number;
    npsh: number;
  }): PhysicsModelResult {
    const { inletPressure, outletPressure, flowRate, temperature } = params;

    const vaporPressure = 0.023 * Math.exp(0.0645 * temperature);
    const npshAvailable = inletPressure - vaporPressure;
    const npshRequired = 2.0 + (flowRate / 100) * 0.5;

    const cavitationMargin = npshAvailable - npshRequired;
    const cavitationRisk = cavitationMargin < 0 ? 1.0 : cavitationMargin < 1.0 ? 0.7 : cavitationMargin < 2.0 ? 0.3 : 0.05;

    const pressureDrop = inletPressure - outletPressure;
    const expectedDrop = flowRate * 0.1;
    const deviation = Math.abs(pressureDrop - expectedDrop) / expectedDrop;

    let explanation = `NPSH analysis: Available=${npshAvailable.toFixed(2)} bar, Required=${npshRequired.toFixed(2)} bar, Margin=${cavitationMargin.toFixed(2)} bar.`;
    if (cavitationRisk > 0.5) explanation += ' WARNING: High cavitation risk — vapor bubbles forming at impeller inlet.';
    if (temperature > 60) explanation += ` Elevated fluid temperature (${temperature}°C) increases vapor pressure.`;

    return {
      modelName: 'Pump Cavitation Model (Bernoulli)',
      equipmentType: 'pump',
      predictedBehavior: cavitationRisk > 0.7 ? 'Active cavitation' : cavitationRisk > 0.3 ? 'Cavitation risk' : 'Normal operation',
      deviationFromNormal: cavitationRisk,
      physicalExplanation: explanation,
      confidence: 0.80,
      parameters: { npshAvailable, npshRequired, cavitationMargin, cavitationRisk, vaporPressure }
    };
  }

  predictMotorThermalDegradation(params: {
    current: number;
    ratedCurrent: number;
    ambientTemperature: number;
    windingTemperature: number;
    operatingHours: number;
  }): PhysicsModelResult {
    const { current, ratedCurrent, ambientTemperature, windingTemperature, operatingHours } = params;

    const loadRatio = current / ratedCurrent;
    const temperatureRise = (windingTemperature - ambientTemperature);
    const maxAllowedRise = 80;
    const thermalStress = temperatureRise / maxAllowedRise;

    const insulationLifeBase = 100000;
    const arrheniusFactor = Math.exp(-0.1 * (windingTemperature - 105));
    const estimatedInsulationLife = insulationLifeBase * (loadRatio <= 1.0 ? 1.0 : Math.pow(1.0 / loadRatio, 2)) * arrheniusFactor;
    const insulationWear = Math.min(100, (operatingHours / estimatedInsulationLife) * 100);

    let explanation = `Motor thermal analysis: Load ratio ${(loadRatio * 100).toFixed(0)}%, winding temperature rise ${temperatureRise.toFixed(0)}°C.`;
    if (loadRatio > 1.1) explanation += ` Overloaded by ${((loadRatio - 1) * 100).toFixed(0)}% — accelerated insulation aging.`;
    if (thermalStress > 0.8) explanation += ` Thermal stress at ${(thermalStress * 100).toFixed(0)}% of maximum — consider load reduction.`;
    explanation += ` Estimated insulation wear: ${insulationWear.toFixed(1)}%.`;

    return {
      modelName: 'Motor Thermal Degradation (Arrhenius)',
      equipmentType: 'motor',
      predictedBehavior: insulationWear > 80 ? 'Insulation failure risk' : insulationWear > 60 ? 'Advanced aging' : insulationWear > 30 ? 'Normal aging' : 'Good condition',
      deviationFromNormal: thermalStress,
      physicalExplanation: explanation,
      confidence: 0.78,
      parameters: { loadRatio, thermalStress, insulationWear, estimatedInsulationLife },
      remainingUsefulLife: Math.max(0, estimatedInsulationLife - operatingHours)
    };
  }

  predictCompressorPerformance(params: {
    inletPressure: number;
    outletPressure: number;
    inletTemperature: number;
    outletTemperature: number;
    flowRate: number;
    power: number;
  }): PhysicsModelResult {
    const { inletPressure, outletPressure, inletTemperature, outletTemperature, flowRate, power } = params;

    const compressionRatio = outletPressure / inletPressure;
    const gammaAir = 1.4;
    const idealOutletTemp = (inletTemperature + 273.15) * Math.pow(compressionRatio, (gammaAir - 1) / gammaAir) - 273.15;
    const isentropicEfficiency = (idealOutletTemp - inletTemperature) / (outletTemperature - inletTemperature);
    const efficiencyDeviation = Math.abs(isentropicEfficiency - 0.85) / 0.85;

    const idealPower = flowRate * (outletPressure - inletPressure) * 100 / 0.85;
    const powerEfficiency = idealPower > 0 ? idealPower / power : 1;

    let explanation = `Compressor analysis: Compression ratio ${compressionRatio.toFixed(2)}, isentropic efficiency ${(isentropicEfficiency * 100).toFixed(1)}%.`;
    if (isentropicEfficiency < 0.7) explanation += ' Low efficiency indicates internal wear or valve issues.';
    if (outletTemperature > idealOutletTemp * 1.15) explanation += ` Outlet temperature ${outletTemperature.toFixed(0)}°C exceeds ideal by ${((outletTemperature / idealOutletTemp - 1) * 100).toFixed(0)}%.`;

    return {
      modelName: 'Compressor Performance (Isentropic)',
      equipmentType: 'compressor',
      predictedBehavior: isentropicEfficiency < 0.6 ? 'Major degradation' : isentropicEfficiency < 0.75 ? 'Performance loss' : 'Normal operation',
      deviationFromNormal: efficiencyDeviation,
      physicalExplanation: explanation,
      confidence: 0.82,
      parameters: { compressionRatio, isentropicEfficiency, idealOutletTemp, powerEfficiency }
    };
  }

  selectAndRunModel(equipmentType: string, sensorData: Record<string, number>): PhysicsModelResult | null {
    const type = equipmentType.toLowerCase();

    if (type.includes('moteur') || type.includes('motor')) {
      return this.predictMotorThermalDegradation({
        current: sensorData.current || 85,
        ratedCurrent: sensorData.ratedCurrent || 100,
        ambientTemperature: sensorData.ambientTemperature || 35,
        windingTemperature: sensorData.temperature || 65,
        operatingHours: sensorData.operatingHours || 5000
      });
    }

    if (type.includes('pompe') || type.includes('pump')) {
      return this.predictPumpCavitation({
        inletPressure: sensorData.inletPressure || sensorData.pressure || 3.0,
        outletPressure: sensorData.outletPressure || (sensorData.pressure || 3.0) + 2.0,
        flowRate: sensorData.flowRate || sensorData.flow || 50,
        temperature: sensorData.temperature || 40,
        npsh: sensorData.npsh || 5.0
      });
    }

    if (type.includes('compresseur') || type.includes('compressor')) {
      return this.predictCompressorPerformance({
        inletPressure: sensorData.inletPressure || 1.0,
        outletPressure: sensorData.outletPressure || sensorData.pressure || 8.0,
        inletTemperature: sensorData.inletTemperature || 25,
        outletTemperature: sensorData.outletTemperature || sensorData.temperature || 120,
        flowRate: sensorData.flowRate || sensorData.flow || 100,
        power: sensorData.power || 75
      });
    }

    if (sensorData.vibration && sensorData.temperature) {
      return this.predictBearingLife({
        temperature: sensorData.temperature,
        vibration: sensorData.vibration,
        speed: sensorData.speed || 1500,
        load: sensorData.load || 70,
        operatingHours: sensorData.operatingHours || 5000
      });
    }

    return null;
  }
}

let physicsModelInstance: ThermoMechanicalModel | null = null;

export function getPhysicsModel(): ThermoMechanicalModel {
  if (!physicsModelInstance) {
    physicsModelInstance = new ThermoMechanicalModel();
  }
  return physicsModelInstance;
}
