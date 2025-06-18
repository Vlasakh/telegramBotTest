/**
 * vlasakh_test_bot
 */
import config from "config";
import TelegramBot from "node-telegram-bot-api";

const token = config.get("TOKEN");

const bot = new TelegramBot(token, { polling: true });

const YOUR_CHANNEL_ID = -100123456789;
const YOUR_DISCUSSION_GROUP_ID = -100987654322;

const cutComments = new Map();

bot.onText(/\/start/, (msg) => {
	const chatId = msg.chat.id;
	bot.sendMessage(chatId, "Привет! Я простой тестовый бот. Напиши мне что-нибудь!");
});

bot.on("message", async (msg) => {
	const userId = msg.from.id;
	const commandText = msg.text;

	if (commandText && commandText.toLowerCase().trim() === "/cut") {
		const isAdmin = await isUserAdmin(YOUR_DISCUSSION_GROUP_ID, userId);

		if (!isAdmin) {
			bot.sendMessage(msg.chat.id, "Cut for admins only");
			return;
		}

		// Собираем информацию о пересланных комментариях
		const commentsToTransfer = {
			originalChatId: null, // Будет ID группы обсуждения
			messageIds: [], // ID оригинальных сообщений в группе обсуждения
			originalChannelPostId: null, // ID поста в канале, к которому они относились
		};

		// Telegram Bot API при пересылке нескольких сообщений отправляет их по одному
		// или группирует в `media_group_id` для альбомов.
		// Каждый `msg` объект, который бот получает, будет одним из пересланных сообщений,
		// если пользователь их переслал.
		// Важно: `bot.on('message')` будет вызываться для каждого пересланного сообщения,
		// если они не составляют медиа-группу.
		// Если они составляют медиа-группу, `bot.on('message')` будет вызван один раз для первого сообщения
		// с полем `media_group_id`, и вы можете использовать `bot.on('media_group')` для обработки.
		// Для текстовых сообщений, `bot.on('message')` вызывается для каждого.

		// Для простоты, здесь мы предполагаем, что пользователь пересылает сообщения по одному
		// или бот получает их по одному (это чаще всего так для текстовых).
		// Если вы хотите обрабатывать МНОГО пересланных сообщений за раз, вам нужно более сложное
		// отслеживание (например, по `media_group_id` или по временным меткам).

		// *ОБРАТИТЕ ВНИМАНИЕ*: Если пользователь выделит 5 сообщений и перешлет их боту,
		// обработчик `bot.on('message')` сработает 5 раз (плюс один раз для самой команды `/cut`).
		// Вам нужно будет собрать эти сообщения.
		// Лучший способ: пользователь пересылает сообщения, а ПОТОМ отправляет команду /cut.
		// Или команду /cut отправить как ОТВЕТ на пересланные сообщения.

		// Давайте изменим логику: пользователь пересылает сообщения, а *затем* отправляет команду /cut.
		// Или делает команду /cut *ответом* на одно из пересланных сообщений.

		// --- Улучшенный алгоритм: `/cut` как ответ на пересланное сообщение ---
		if (msg.reply_to_message && msg.reply_to_message.forward_from_chat) {
			const repliedToOriginalMessage = msg.reply_to_message;

			// Проверяем, что это пересланное сообщение из группы обсуждения
			if (
				repliedToOriginalMessage.chat.id === YOUR_DISCUSSION_GROUP_ID &&
				isCommentToChannelPost(repliedToOriginalMessage, YOUR_CHANNEL_ID)
			) {
				commentsToTransfer.originalChatId = YOUR_DISCUSSION_GROUP_ID;
				commentsToTransfer.messageIds.push(repliedToOriginalMessage.forward_from_message_id); // Оригинальный ID в группе обсуждения
				commentsToTransfer.originalChannelPostId = repliedToOriginalMessage.forward_from_message_id; // ID поста в канале (это же ID)

				cutComments.set(userId, commentsToTransfer);
				bot.sendMessage(
					msg.chat.id,
					`Комментарий с ID ${repliedToOriginalMessage.forward_from_message_id} запомнен для переноса. Теперь перейдите к другому посту и используйте команду /paste.`,
				);

				// Опционально: удалить команду /cut
				try {
					await bot.deleteMessage(msg.chat.id, msg.message_id);
				} catch (error) {
					console.warn(`Не удалось удалить команду /cut: ${error.message}`);
				}
			} else {
				bot.sendMessage(msg.chat.id, "Ответьте на *пересланный* комментарий из группы обсуждения.");
			}
		} else {
			bot.sendMessage(
				msg.chat.id,
				"Чтобы вырезать комментарий, перешлите его мне, а затем ответьте на пересланное сообщение командой /cut.",
			);
			// Или если хотите обрабатывать несколько пересланных, то сложнее:
			// "Перешлите мне несколько комментариев, а затем отправьте /cut"
			// В этом случае боту нужно будет сохранять *все* сообщения, полученные от пользователя
			// между двумя командами или за короткий промежуток времени.
		}
	}
	// ... (остальной код для /paste) ...
});

console.log("Бот запущен...");

async function isUserAdmin(chatId, userId) {
	try {
		const chatMember = await bot.getChatMember(chatId, userId);
		return ["creator", "administrator"].includes(chatMember.status);
	} catch (error) {
		console.error(`User ${userId} is not an admin in the chat ${chatId}:`, error.message);
		return false;
	}
}
