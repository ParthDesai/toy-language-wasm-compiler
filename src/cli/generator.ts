import fs from 'fs';
import path from 'path';
import { Main, Animal, Instance, World } from '../language-server/generated/ast';
import { extractDestinationAndName } from './cli-util';

function stringToBinary(str: string): {data: Uint8Array, length: number} {
    const serializedStr = str.split('').map(function (ch) {return ch.charCodeAt(0)});
    const data = new Uint8Array(serializedStr.length + 1);
    data.set(serializedStr, 0);
    return {data, length: data.length};
}

function offset32(i: number): number {
    return i*4;
}

function animalToBinary(animal: Animal): {data: Uint8Array, length: number} {
    const serializedGenes = stringToBinary(animal.gene);
    const serializedAnimalName = stringToBinary(animal.name);
    const serializedAnimalSound = stringToBinary(animal.sound);

    const indexes: number[] = [
        offset32(3), 
        offset32(3) + serializedGenes.length,
        offset32(3) + serializedGenes.length + serializedAnimalName.length
    ];

    const animalArray = new Uint8Array(offset32(3) + serializedGenes.length + serializedAnimalName.length + serializedAnimalSound.length);
    new DataView(animalArray.buffer).setInt32(offset32(0), indexes[0], true);
    animalArray.set(serializedGenes.data, indexes[0]);

    new DataView(animalArray.buffer).setInt32(offset32(1), indexes[1], true);
    animalArray.set(serializedAnimalName.data, indexes[1]);

    new DataView(animalArray.buffer).setInt32(offset32(2), indexes[2], true);
    animalArray.set(serializedAnimalSound.data, indexes[2]);

    return {data: animalArray, length: animalArray.length};
}

function instanceToBinary(instance: Instance, animalTable: Map<string, number>): {data: Uint8Array, length: number} {
    const serializedName = stringToBinary(instance.name);
    if (instance.species.ref === undefined) {
        throw Error("Reference to species is undefined");
    }
    const speciesRef = animalTable.get(instance.species.ref?.name);
    if (speciesRef === undefined) {
        throw Error("Cannot find reference to species");
    }
    const serializedSpeciesRef = new Uint8Array(4);
    new DataView(serializedSpeciesRef.buffer).setUint32(0, speciesRef, true);

    const indexes: number[] = [
        offset32(3), 
        offset32(3) + offset32(1),
        offset32(3) + offset32(1) + serializedName.length
    ];

    const instanceArray = new Uint8Array(offset32(3) + 4 + serializedName.length + 4);
    new DataView(instanceArray.buffer).setInt32(offset32(0), indexes[0], true);

    new DataView(instanceArray.buffer).setInt32(offset32(1), indexes[1], true);
    instanceArray.set(serializedName.data, indexes[1]);

    new DataView(instanceArray.buffer).setInt32(offset32(2), indexes[2], true);
    instanceArray.set(serializedSpeciesRef, indexes[2]);

    return {data: instanceArray, length: instanceArray.length};
}

function setInitialWorldRefOnInstance(mem: Uint8Array, instanceRef: number, worldRef: number): void {
    new DataView(mem.buffer).setInt32(instanceRef + offset32(3), worldRef, true);
}

function worldToBinary(world: World, instanceTable: Map<string, number>): {data: Uint8Array, length: number} {
    const serializedName = stringToBinary(world.name);

    const serializedContains = Array<Uint8Array>(world.contains.length);

    const indexes: number[] = [
        offset32(2),
        offset32(2) + serializedName.length
    ];

    const worldArray = new Uint8Array(offset32(2) + serializedName.length + world.contains.length*4);

    new DataView(worldArray.buffer).setInt32(offset32(0), indexes[0], true);
    worldArray.set(serializedName.data, indexes[0]);

    new DataView(worldArray.buffer).setInt32(offset32(1), indexes[1], true);
    world.contains.forEach((containedInstance, i) => {
        if (containedInstance.ref === undefined) {
            throw Error("Cannot find reference to instance");
        }

        serializedContains[i] = new Uint8Array(4);
        const instanceRef = instanceTable.get(containedInstance.ref.name);
        if (instanceRef === undefined) {
            throw Error("Cannot find reference to instance in table");
        }
        new DataView(serializedContains[i].buffer).setInt32(0, instanceRef, true);
        worldArray.set(serializedContains[i], (i*4)+indexes[1]);
    });

    return {data: worldArray, length: worldArray.length};
}

function createMemory(main: Main): {mem: Uint8Array, animalTable: Map<string, number>, instanceTable: Map<string, number>, worldTable: Map<string, number>} {
    const animalTable = new Map<string, number>();
    const serializedAnimals = new Array<Uint8Array>(main.animals.length);

    let currentIndex = 0;

    main.animals.forEach((animal, i) => {
        const serializedAnimal = animalToBinary(animal);
        animalTable.set(animal.name, currentIndex);
        serializedAnimals[i] = serializedAnimal.data;

        currentIndex += serializedAnimal.length;
    });

    const instanceTable = new Map<string, number>();
    const serializedInstances = new Array<Uint8Array>(main.instances.length);

    main.instances.forEach((instance, i) => {
        const serializedInstance = instanceToBinary(instance, animalTable);
        instanceTable.set(instance.name, currentIndex);
        serializedInstances[i] = serializedInstance.data;

        currentIndex += serializedInstance.length;
    });

    const worldTable = new Map<string, number>();
    const serializedWorlds = new Array<Uint8Array>(main.worlds.length);

    main.worlds.forEach((world, i) => {
        const serializedWorld = worldToBinary(world, instanceTable);
        worldTable.set(world.name, currentIndex);
        serializedWorlds[i] = serializedWorld.data;

        currentIndex += serializedWorld.length;
    });

    // Fill up the buffer now that we know the length
    const mem = new Uint8Array(currentIndex);
    main.animals.forEach((animal, i) => {
        const offset = animalTable.get(animal.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedAnimals[i], offset);
    });

    main.instances.forEach((instance, i) => {
        const offset = instanceTable.get(instance.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedInstances[i], offset);
    });

    main.worlds.forEach((world, i) => {
        const offset = worldTable.get(world.name);
        if (offset === undefined) {
            throw Error("undefined offset");
        }

        mem.set(serializedWorlds[i], offset);

        world.contains.forEach((instance) => {
            if (instance.ref === undefined) {
                throw Error("unresolved reference");
            }

            let instanceRef = instanceTable.get(instance.ref.name);
            if (instanceRef == undefined) {
                throw Error("unresolved offset");
            }

            setInitialWorldRefOnInstance(mem, instanceRef, offset);
        });
    });


    return {
        mem: mem,
        animalTable: animalTable,
        instanceTable: instanceTable,
        worldTable: worldTable
    };
}

export function generateWasm(main: Main, filePath: string, destination: string | undefined): Promise<string> {
    const data = extractDestinationAndName(filePath, destination);
    const generatedFilePath = `${path.join(data.destination, data.name)}.wasm`;

    let memoryLayout = createMemory(main);

    return import('binaryen').then(function (mod) {
        const binaryen = mod.default;
        const wasmModule = new mod.default.Module();
        wasmModule.setMemory(1, 256, "0", [
            {
                passive: false,
                offset: wasmModule.i32.const(0),
                data: memoryLayout.mem
            }
        ], false);

        const wasmInstructions: number[] = []; 

        // Memory transfer instructions
        main.transfer.forEach((transfer) => {
            if (transfer.animalToTransfer.ref === undefined) {
                throw new Error("unable to find reference to instance");
            }

            if (transfer.to.ref === undefined) {
                throw new Error("unable to find reference to the world to transfer instance to");
            }

            const instanceRef = memoryLayout.instanceTable.get(transfer.animalToTransfer.ref.name);
            if (instanceRef === undefined) {
                throw new Error("unable to find memory reference to instance");
            }
            const worldRef = memoryLayout.worldTable.get(transfer.to.ref?.name);
            if (worldRef === undefined) {
                throw new Error("unable to find memory reference to world");
            }

            wasmInstructions.push(wasmModule.i32.store(offset32(3), 0, wasmModule.i32.const(instanceRef), wasmModule.i32.const(worldRef)));
        });

        
        //Narrating instruction
        main.instances.forEach(function (instance) {
            const instanceRef = memoryLayout.instanceTable.get(instance.name);
            if (instanceRef === undefined) {
                throw new Error("unable to find reference to the instance");
            }

            // Fetch the instance header
            let loadInstanceHeader = wasmModule.i32.load(0, 0, wasmModule.i32.const(instanceRef));
            // Add the value of header to instance reference
            let addWorldRefOffset = wasmModule.i32.add(loadInstanceHeader, wasmModule.i32.const(instanceRef));
            // Load the reference to the world
            let loadWorldRef = wasmModule.i32.load(0, 0, addWorldRefOffset);
            // Load the reference to the name
            let loadWorldNameRef = wasmModule.i32.load(0, 0, loadWorldRef);
            // Add world name offset to the object offset
            let getWorldName = wasmModule.i32.add(wasmModule.copyExpression(loadWorldRef), loadWorldNameRef);

            // Fetch the instance name

            // Fetch the instance name header
            let loadInstanceNameHeader = wasmModule.i32.load(offset32(1), 0, wasmModule.i32.const(instanceRef));
            // Add value of header to instance reference
            let getInstanceName = wasmModule.i32.add(loadInstanceNameHeader, wasmModule.i32.const(instanceRef));

            // Fetch the animal name + species + sound

            // Load the header that gives us offset of the animal ref
            let loadInstanceAnimalRefHeader = wasmModule.i32.load(offset32(2), 0, wasmModule.i32.const(instanceRef));
            // Add the offset with the instance reference
            let addAnimalRefOffset = wasmModule.i32.add(loadInstanceAnimalRefHeader, wasmModule.i32.const(instanceRef));
            // Load the animal reference at that offset
            let loadAnimalRef = wasmModule.i32.load(0, 0, addAnimalRefOffset);

            // load the animal name reference from previous load
            let loadAnimalNameRef = wasmModule.i32.load(offset32(1), 0, loadAnimalRef);
            // Add the offset with animal reference
            let getAnimalName = wasmModule.i32.add(wasmModule.copyExpression(loadAnimalRef), loadAnimalNameRef);

            // load the animal species reference from previous load
            let loadAnimalGeneRef = wasmModule.i32.load(offset32(0), 0, loadAnimalRef);
            // Add the offset with animal reference
            let getAnimalGene = wasmModule.i32.add(wasmModule.copyExpression(loadAnimalRef), loadAnimalGeneRef);

            // load the animal sound reference from previous load
            let loadAnimalSoundRef = wasmModule.i32.load(offset32(2), 0, loadAnimalRef);
            // Add the sound offset with animal reference
            let getAnimalSound = wasmModule.i32.add(wasmModule.copyExpression(loadAnimalRef), loadAnimalSoundRef);

            // make the narration call
            wasmInstructions.push(wasmModule.call("log", [
                getWorldName,
                getAnimalGene,
                getAnimalName,
                getInstanceName,
                getAnimalSound
            ], binaryen.createType([])));
            
        });
        

        // Return instruction
        wasmInstructions.push(wasmModule.return(wasmModule.i32.const(0)));

        wasmModule.addFunctionImport("log", "main", "log", binaryen.createType([binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32, binaryen.i32]), binaryen.createType([]));

        wasmModule.addFunction("add", binaryen.createType([]), binaryen.i32, [ binaryen.i32 ],
            wasmModule.block(null, wasmInstructions)
        );
        wasmModule.addFunctionExport("add", "add");

      
        // Optimize the module using default passes and levels
        wasmModule.optimize();
    
        // Validate the module
        if (!wasmModule.validate())
            throw new Error("validation error");
    
        // Generate text format
        var textData = wasmModule.emitText();
        console.log(textData);

        if (!fs.existsSync(data.destination)) {
            fs.mkdirSync(data.destination, { recursive: true });
        }
        
        fs.writeFileSync(generatedFilePath, wasmModule.emitBinary());
        return generatedFilePath; 
    });
}
