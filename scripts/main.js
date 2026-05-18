import {
    CommandPermissionLevel,
    CustomCommandStatus,
    Player,
    system,
    world
} from "@minecraft/server";

const trashData = new Map();

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
        {
            name: "tr:trash",
            description: "ゴミ箱を開く",
            permissionLevel: CommandPermissionLevel.Any,
            cheatsRequired: false
        },
        (origin) => {
            const player = origin.initiator;
            if (!(player instanceof Player)) {
                return { status: CustomCommandStatus.Failure };
            }

            system.run(() => {
                openTrashChest(player);
            });

            return { status: CustomCommandStatus.Success };
        }
    );
});

function openTrashChest(player) {
    try {
        const dim = player.dimension;
        const pos = {
            x: Math.floor(player.location.x),
            y: Math.floor(player.location.y) + 3,
            z: Math.floor(player.location.z)
        };
        
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
        
        const originalState = new Map();
        for (let i = 0; i < playerInv.size; i++) {
            const item = playerInv.getItem(i);
            if (item) {
                originalState.set(i, { typeId: item.typeId, amount: item.amount });
            }
        }
        
        trashData.set(player.id, {
            pos,
            dim,
            originalState
        });
        
        player.sendMessage("§a[ ゴミ箱 ] チェストが開きました");
        
        const checkInterval = system.runInterval(() => {
            if (dim.getBlock(pos).typeId !== "minecraft:chest") {
                checkDeletedItems(player);
                system.clearRun(checkInterval);
            }
        }, 1);
        
    } catch (err) {
        player.sendMessage("§cエラー: " + err);
    }
}

function checkDeletedItems(player) {
    try {
        const data = trashData.get(player.id);
        if (!data) return;
        
        const playerInv = player.getComponent("minecraft:inventory").container;
        const originalState = data.originalState;
        let deletedItems = [];
        
        for (let [slot, originalItem] of originalState) {
            const currentItem = playerInv.getItem(slot);
            if (!currentItem) {
                deletedItems.push(originalItem.typeId.replace("minecraft:", ""));
            }
        }
        
        if (deletedItems.length > 0) {
            player.playSound("random.explode");
            for (let itemName of deletedItems) {
                player.sendMessage("§a[ ゴミ箱 ] §7" + itemName + " を削除しました");
            }
        }
        
        data.dim.setBlockType(data.pos, "minecraft:air");
        trashData.delete(player.id);
        
    } catch (err) {
        player.sendMessage("§cエラー: " + err);
    }
}
