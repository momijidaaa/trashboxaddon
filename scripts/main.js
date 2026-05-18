import {
    CommandPermissionLevel,
    CustomCommandStatus,
    Player,
    system,
    world,
    EquipmentSlot,
    Container,
    BlockPermutation
} from "@minecraft/server";

const trashData = new Map();

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
        {
            name: "tr:trash",
            description: "ゴミ箱",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false,
        },
        (origin) => {
            const player = origin.initiator ?? origin.sourceEntity;
            if (!(player instanceof Player)) return { status: CustomCommandStatus.Failure };

            system.run(() => {
                openTrashChest(player);
            });

            return { status: CustomCommandStatus.Success };
        }
    );
});

function openTrashChest(player) {
    const dim = player.dimension;
    const pos = { x: Math.floor(player.location.x), y: Math.floor(player.location.y) + 3, z: Math.floor(player.location.z) };
    
    dim.setBlockType(pos, "minecraft:chest");
    const chestBlock = dim.getBlock(pos);
    const chestContainer = chestBlock.getComponent("minecraft:inventory").container;
    
    const playerInv = player.getComponent("minecraft:inventory").container;
    for (let i = 0; i < playerInv.size; i++) {
        const item = playerInv.getItem(i);
        if (item) {
            chestContainer.setItem(i, item.clone());
        }
    }
    
    player.openContainer(chestContainer);
    
    trashData.set(player.id, {
        pos,
        dim,
        originalInv: new Map(),
        checkInterval: null
    });
    
    for (let i = 0; i < playerInv.size; i++) {
        const item = playerInv.getItem(i);
        if (item) {
            trashData.get(player.id).originalInv.set(i, item.clone());
        }
    }
    
    const checkInterval = system.runInterval(() => {
        if (dim.getBlock(pos).typeId !== "minecraft:chest") {
            checkDeletedItems(player, pos, dim);
            system.clearRun(checkInterval);
            trashData.delete(player.id);
        }
    }, 2);
}

function checkDeletedItems(player, pos, dim) {
    const playerInv = player.getComponent("minecraft:inventory").container;
    const data = trashData.get(player.id);
    
    if (!data) return;
    
    const originalInv = data.originalInv;
    let deletedCount = 0;
    
    for (let i = 0; i < playerInv.size; i++) {
        const currentItem = playerInv.getItem(i);
        const originalItem = originalInv.get(i);
        
        if (originalItem && !currentItem) {
            deletedCount++;
            player.sendMessage(`§a[ ゴミ箱 ] §7${originalItem.typeId.replace("minecraft:", "")} を削除`);
        }
    }
    
    if (deletedCount > 0) {
        player.playSound("random.explode");
    }
    
    dim.setBlockType(pos, "minecraft:air");
}

system.afterEvents.playerLeave.subscribe((event) => {
    trashData.delete(event.player.id);
});
