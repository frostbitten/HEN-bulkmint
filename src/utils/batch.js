import * as fflate from 'fflate'
import mime from 'mime-types'
import { IPFS_DIRECTORY_MIMETYPE } from '../constants'
import {  injectCSPMetaTagIntoBuffer } from '../utils/html'
import YAML from 'yaml'

export async function prepareBatchFilesFromZIP(buffer) {
  // unzip files
  let files = await unzipBuffer(buffer)

  // save raw index file
  // const indexBlob = files['index.html']
  // files['index_raw.html'] = new Blob([indexBlob], { type: indexBlob.type })

  // inject CSP meta tag in all html files
  for (let k in files) {
    if (k.endsWith('.html') || k.endsWith('.htm')) {
      const pageBuffer = await files[k].arrayBuffer()
      const safePageBuffer = injectCSPMetaTagIntoBuffer(pageBuffer)
      files[k] = new Blob([safePageBuffer], {
        // type: indexBlob.type,
      })
    }
  }

  // reformat
  files = Object.entries(files).map((file) => {
    return {
      path: file[0],
      blob: file[1],
    }
  })

  // remove top level dir
  files = files.filter((f) => f.path !== '')

  return files
}
export function baseName(filename){
	return filename.split('.').slice(0, -1).join('.')
}

export async function parseDetailsFromTxt(textRaw) {
	const regexTitle = /^title:[^\S\r\n]*(.+)/gim
	const regexAmount = /^amount:[^\S\r\n]*([0-9]+)/gim
	const regexRoyalties = /^royalties:[^\S\r\n]*([0-9]+)/gim
	const regexTags = /^tags:[^\S\r\n]*(.+)/gim
	const regexDescription = /^description:\s*([\s\S]+)/gim
	// const regexAttributes = /^attributes:\s*([\s\S]+):attributes/gim
	const regexAttributes = /(?<=attributes\:)(.*)(?=\:attributes)/is
	const regexAdditionalCreators = /^additionalCreators:((?:\s*tz[a-zA-Z0-9]{34},?\s)+)/gim
	
	// 
	
	const amount = regexAmount.exec(textRaw)?.[1]+""
	const royalties = regexRoyalties.exec(textRaw)?.[1]+""
	const title = regexTitle.exec(textRaw)?.[1]
	const description = regexDescription.exec(textRaw)?.[1]
	const tags = regexTags.exec(textRaw)?.[1]
	const attributesRaw = (regexAttributes.exec(textRaw)?.[1]??'').trimEnd().replace(/\t/g, '  ')
	const additionalCreators = regexAdditionalCreators.exec(textRaw)?.[1].trim().split(',').map((walletStr) => { return walletStr.trim(); }) ?? [] 
	console.log('attributesRaw:',attributesRaw)
	const attributes = YAML.parse(attributesRaw);
	console.log('attributes:',attributes)
	
	// console.log('parsed the DetailsFromTxt',{
		// title,
		// amount,
		// royalties,
		// description,
		// tags,
	// });
	return {
		title,
		amount,
		royalties,
		description,
		tags,
		attributes,
		additionalCreators,
	}
}

export async function readFileAsDataURL(file) {
    let result_base64 = await new Promise((resolve) => {
        let fileReader = new FileReader();
        fileReader.onload = (e) => resolve(fileReader.result);
        fileReader.readAsDataURL(file);
    });

    // console.log(result_base64); // aGV5IHRoZXJl...

    return result_base64;
}

export async function unzipBuffer(buffer) {
  let entries = fflate.unzipSync(buffer)
  entries = Object.entries(entries).map((entry) => {
    return {
      path: entry[0],
      buffer: entry[1],
    }
  })

  // Find root dir
  let rootDir = null
  console.log('entries:',entries)
  for (let i = 0; i < entries.length; i++) {
    const parts = entries[i].path.split('/')
    const filename = parts[parts.length - 1]
    if (filename === 'index.html') {
      const parts = entries[i].path.split('/')
      parts.pop()
      rootDir = parts.join('/')
      break
    }
  }

  // if (rootDir === null) {
    // const msg = 'No index.html file found!'
    // window.alert(msg)
    // throw new Error(msg)
  // }

  // Create files map
  const files = {}
  entries.forEach((entry, index) => {
    const relPath = entry.path;//.replace(`${rootDir}/`, '')
    let type
    if (entry.buffer.length === 0 && entry.path.endsWith('/')) {
      type = IPFS_DIRECTORY_MIMETYPE
    } else {
      type = mime.lookup(entry.path)
    }

    files[relPath] = new Blob([entry.buffer], {
      type,
    })
  })

  return files
}