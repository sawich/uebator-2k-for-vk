
const getUrlParameterValue = (url, parameterName) => {
	"use strict";

	var urlParameters  = url.substr(url.indexOf("#") + 1),
		parameterValue = "",
		index,
		temp;

	urlParameters = urlParameters.split("&");

	for (index = 0; index < urlParameters.length; index += 1) {
		temp = urlParameters[index].split("=");

		if (temp[0] === parameterName) {
			return temp[1];
		}
	}

	return parameterValue;
}

const api_access = (origin) => {
	return new Promise ((resolve, reject) => {
		chrome.storage.local.get(origin.type, function (items) {
			if (undefined !== items[origin.type] && items[origin.type].length !== undefined) {
				resolve (items[origin.type])
				return
			}

			chrome.tabs.create({
				url: `https://oauth.vk.com/authorize?client_id=${app.client_id}&scope=${app.scope}${'page' !== origin.type ? `&group_id=${origin.id}` : ''}&redirect_uri=http%3A%2F%2Foauth.vk.com%2Fblank.html&display=page&response_type=token`,
				selected: true
			}, tab => {
				chrome.tabs.onUpdated.addListener (function tabUpdateListener (tabId, changeInfo) {
					var vkAccessToken,
						vkAccessTokenExpiredFlag;

					if (tabId === tab.id && changeInfo.url !== undefined && changeInfo.status === "loading") {

						if (changeInfo.url.indexOf('oauth.vk.com/blank.html') > -1) {
							tab.id = null;
							chrome.tabs.onUpdated.removeListener(tabUpdateListener);

							vkAccessToken = getUrlParameterValue(changeInfo.url, 'access_token');

							if (vkAccessToken === undefined || vkAccessToken.length === undefined) {
								reject('vk auth response problem', 'access_token length = 0 or vkAccessToken == undefined');
								return;
							}

							vkAccessTokenExpiredFlag = Number(getUrlParameterValue(changeInfo.url, 'expires_in'));

							if (vkAccessTokenExpiredFlag !== 0) {
								reject('vk auth response problem', 'vkAccessTokenExpiredFlag != 0' + vkAccessToken);
								return;
							}

							chrome.storage.local.set({[origin.type]: vkAccessToken}, function () {
								resolve (vkAccessToken)
							});
						}
					}
				});
			});
		});
	})
}

/* * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * */

const vkOnClickAll = (vk_album) => {
	return (info, tab) => {
		api_access ('page').then (api_key => {
			upload ([ info, api_key, vk_album, { type: 'page' } ]).then (async documentSaveRequest => {
				for (const id of page.for_users) {
					await post_on_wall ([ id, api_key, documentSaveRequest, { type: 'page' }]).catch (console.error)
				}
			}).catch (console.error)
		}).catch (console.error)
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * */

const vkOnClickSingle = ({ wall_id, album_id, origin }) => {
	return (info, tab) => {
		api_access (origin).then (api_key => {
			upload ([ info, 'page' === origin.type ? api_key : `${api_key}&group_id=${wall_id}`, album_id, origin ]).then (documentSaveRequest => {
				post_on_wall ([ wall_id, api_key, documentSaveRequest, origin ]).catch (console.error)
			}).catch (console.error)
		}).catch (console.error)
	}
}

/* * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * */

fetch (`https://api.vk.com/method/users.get?user_ids=${page.for_users.join (',')}&v=${app.api_v}`).then (response => response.json ()).then (users => {
	if (users.response.length > 0) {
		for (const a of page.albums) {
			chrome.contextMenus.create({
				title: `[${a.tag}] Всем`,
				type: "normal",
				contexts: ["image"],
				onclick: vkOnClickAll(a.id)
			})
		
			chrome.contextMenus.create({
				type: 'separator',
				contexts: ["image"]
			})
		
			for (const user of users.response) {
				chrome.contextMenus.create({
					title: `${user.first_name} ${user.last_name}`,
					type: "normal",
					contexts: ["image"],
					onclick: vkOnClickSingle ({
						wall_id: user.id,
						album_id: a.id,
						origin: {
							type: 'page'
						}
					})
				})
			}
			chrome.contextMenus.create({
				type: 'separator',
				contexts: ["image"]
			})
		}
	}


	fetch (`https://api.vk.com/method/groups.getById?group_ids=${[...clubs.keys ()].join (',')}&v=${app.api_v}`).then (response => response.json ()).then (response => {
	
	if (response.response.length > 0) {		console.log (response.response.length > 0)	
			/*chrome.contextMenus.create({
				type: 'separator',
				contexts: ["image"]
			})			

			chrome.contextMenus.create({
				title: `[ГРУППЫ] Всем`,
				type: "normal",
				contexts: ["image"],
				onclick: vkOnClickAll(a.id)
			})*/
		
			chrome.contextMenus.create({
				type: 'separator',
				contexts: ["image"]
			})

			for (const club of response.response) {
				chrome.contextMenus.create ({
					title: club.name,
					type: "normal",
					contexts: ["image"],
					onclick: vkOnClickSingle ({
						wall_id: club.id,
						album_id: clubs.get (club.id),
						origin: {
							type: `club${club.id}`,
							id: club.id
						}
					})
				})
			}
		}
	})
})

/* * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * */

const post_on_wall = ([ wall_id, api_key, documentSaveRequest, origin ]) => {
	return new Promise ((resolve, reject) => {
		fetch (`https://api.vk.com/method/wall.post?access_token=${api_key}&owner_id=${'page' !== origin.type ? `${wall_id * -1}&from_group=1` : `${wall_id}`}&attachments=photo${documentSaveRequest.response[0].owner_id}_${documentSaveRequest.response[0].id}&v=${app.api_v}`, {
				method: 'GET'
		}).then (response => response.json()).then (response => {
			if (response.error !== undefined) {
				return reject (response.error)
			}
			resolve ()
		})
	})
}

/* * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * *
 * * * * * * * * * * * * * * * * * * * * * * * * */

const upload = ([ info, api_key, vk_album, origin ]) => {
	return new Promise ((resolve, reject) => {
		fetch (`https://api.vk.com/method/photos.getUploadServer?access_token=${api_key}&album_id=${vk_album}&v=${app.api_v}`, {
			method: 'GET'
		}).then (getUploadServer => getUploadServer.json ()).then (getUploadServer => {
			if (getUploadServer.error !== undefined) {
				chrome.storage.local.remove (origin.type)
				return reject (getUploadServer.error)
			}

			fetch (info.srcUrl, { method: 'GET' }).then (blob_image_data => blob_image_data.blob ()).then (blob_image_data => {
				const picture = new FormData
				picture.append ('file', blob_image_data, info.srcUrl.split('/'))

				fetch (getUploadServer.response.upload_url, {
					method: 'POST',
					body: picture
				}).then (documentUploadRequest => documentUploadRequest.json ()).then (documentUploadRequest => {
					if (documentUploadRequest.error !== undefined) {
						return reject (documentUploadRequest.error)
					}

					fetch (`https://api.vk.com/method/photos.save?access_token=${api_key}&album_id=${vk_album}&server=${documentUploadRequest.server}&hash=${documentUploadRequest.hash}&photos_list=${documentUploadRequest.photos_list}&v=${app.api_v}`, {
						method: 'GET'
					}).then (documentSaveRequest => documentSaveRequest.json ()).then (documentSaveRequest => {
						if (documentSaveRequest.error !== undefined) {
							return reject (documentSaveRequest.error)
						}

						resolve (documentSaveRequest)
					})
				})
			})
		})
	})
}
