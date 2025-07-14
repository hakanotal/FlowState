import { GUI } from 'dat.gui';

export function createGUI(aircraft) {
    const gui = new GUI();
    const physicsFolder = gui.addFolder('Flight Physics');
    
    physicsFolder.add(aircraft.flightParams, 'liftCoefficient', 0, 1).name('Lift');
    physicsFolder.add(aircraft.flightParams, 'dragCoefficient', 0, 1).name('Drag');
    physicsFolder.add(aircraft.flightParams, 'maxThrust', 100, 2000).name('Max Thrust');
    physicsFolder.add(aircraft.flightParams, 'rollSensitivity', 100, 1000).name('Roll Speed');
    physicsFolder.add(aircraft.flightParams, 'pitchSensitivity', 100, 1000).name('Pitch Speed');
    physicsFolder.open();
    
    return gui;
} 