import {
    Player,
    system,
    world,
    EquipmentSlot
} from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

system.beforeEvents.startup.subscribe(({ customCommandRegistry }) => {
    customCommandRegistry.registerCommand(
        {
            name: "tr:trash",
            description: "ゴミ箱メニューを開きます",
            permissionLevel: "Any",
            cheatsRequired: false,
        },
        (origin) => {
            const player = origin.initiator ?? origin.sourceEntity;
            if (!(player instanceof Player)) {
                return {
                    success: false,
                    message: "このコマンドはプレイヤーのみ使用できます。",
                };
            }

            system.run(() => {
                openTrashMenu(player);
            });

            return { success: true };
        }
    );
});

function openTrashMenu(player) {
    const form = new ActionFormData();
    form.title("§4[ GOMIBYAKO MENU ]");
    form.body("§7捨てる方法を選んでください。\n§c一度捨てたアイテムは戻りません！");
    
    form.button("-> 手に持っているアイテムを捨てる");
    form.button("-> インベントリから選んで捨てる");

    form.show(player).then((response) => {
        if (response.canceled) return;

        if (response.selection === 0) {
            trashMainHand(player);
        } else if (response.selection === 1) {
            openInventoryTrashMenu(player);
        }
    }).catch((err) => {
        console.error(err);
    });
}

function trashMainHand(player) {
    const equippable = player.getComponent("minecraft:equippable");
    if (!equippable) return;

    const mainHandItem = equippable.getEquipment(EquipmentSlot.Mainhand);

    if (!mainHandItem) {
        player.sendMessage("§c[エラー] 手には何も持っていません。");
        return;
    }

    equippable.setEquipment(EquipmentSlot.Mainhand, undefined);
    player.sendMessage("§a[ゴミ箱] 選択していたアイテムを廃棄しました。");
    player.playSound("random.toast");
}

function openInventoryTrashMenu(player) {
    const inventory = player.getComponent("minecraft:inventory").container;
    const form = new ModalFormData();
    form.title("§4[ INVENTORY TRASH ]");

    const itemNames = [];
    for (let i = 0; i < inventory.size; i++) {
        const item = inventory.getItem(i);
        if (item) {
            itemNames.push(`Slot ${i}: ${item.typeId.replace("minecraft:", "")} (x${item.amount})`);
        } else {
            itemNames.push(`Slot ${i}: [--- EMPTY ---]`);
        }
    }

    form.dropdown("破棄したいアイテムのスロットを選択してください:", itemNames, 0);
    form.toggle("§c本当に削除しますか？", false);

    form.show(player).then((response) => {
        if (response.canceled) return;

        const [selectedSlot, confirm] = response.formValues;

        if (!confirm) {
            player.sendMessage("§c[ゴミ箱] 削除がキャンセルされました。");
            return;
        }

        const itemToTrash = inventory.getItem(selectedSlot);
        if (!itemToTrash) {
            player.sendMessage("§c[エラー] 選択されたスロットは空です。");
            return;
        }

        inventory.setItem(selectedSlot, undefined);
        player.sendMessage(`§a[ゴミ箱] スロット ${selectedSlot} のアイテムを破棄しました。`);
        player.playSound("random.explode");
    });
}
