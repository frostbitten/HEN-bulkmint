import {
  IPFS_DIRECTORY_MIMETYPE,
  IPFS_DEFAULT_THUMBNAIL_URI,
} from '../constants'
//import { NFTStorage, File } from 'nft.storage'

const { create } = require('ipfs-http-client')
const Buffer = require('buffer').Buffer
const axios = require('axios')
const readJsonLines = require('read-json-lines-sync').default
const { getCoverImagePathFromBuffer } = require('../utils/html')
const { baseName } = require('../utils/batch')

const infuraUrl = 'https://ipfs.infura.io:5001'
//const apiKey = process.env.REACT_APP_IPFS_KEY
//const storage = new NFTStorage({ token: apiKey })



//const auth =
//  'Basic ' + Buffer.from(projectId + ':' + projectSecret).toString('base64')

const getClient = () => {
	return create({
	  host: 'ipfs.infura.io',
	  port: 5001,
	  protocol: 'https',
	  // headers: {
		// authorization: auth
	  // }
	})
}


export const prepareFile100MB = async ({
  name,
  description,
  tags,
  address,
  buffer,
  mimeType,
  cover,
  thumbnail,
  generateDisplayUri,
  file
}) => {

  const ipfs = create(infuraUrl)

  let formData = new FormData()
  formData.append('file', file)

  let info = await axios.post('https://hesychasm.herokuapp.com/post_file', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }).then(res => res.data)
  const hash = info.path
  const cid = `ipfs://${hash}`

  // upload cover image
  let displayUri = ''
  if (generateDisplayUri) {
    const coverInfo = await ipfs.add(cover.buffer)
    const coverHash = coverInfo.path
    displayUri = `ipfs://${coverHash}`
  }

  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI
  // @crzypatch works wants the thumbnailUri to be the black circle
  // if (generateDisplayUri) {
  //   const thumbnailInfo = await ipfs.add(thumbnail.buffer)
  //   const thumbnailHash = thumbnailInfo.path
  //   thumbnailUri = `ipfs://${thumbnailHash}`
  // }

  return await uploadMetadataFile({
    name,
    description,
    tags,
    cid,
    address,
    mimeType,
    displayUri,
    thumbnailUri,
  })
}

export const prepareFile = async ({
  name,
  description,
  tags,
  address,
  buffer,
  mimeType,
  cover,
  thumbnail,
  generateDisplayUri,
}) => {
  // const ipfs = create(infuraUrl)
  const ipfs = getClient()

  // upload main file
 // const ipfs = create(infuraUrl)

  const hash = await ipfs.add(new Blob([buffer]))
  console.log(hash)
  const cid = `ipfs://${hash.path}`

  // upload cover image
  let displayUri = ''
  if (generateDisplayUri) {
    const coverHash = await ipfs.add(new Blob([cover.buffer]))
    console.log(coverHash)
    displayUri = `ipfs://${coverHash.path}`
  }

  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI
  // @crzypatch works wants the thumbnailUri to be the black circle
  // if (generateDisplayUri) {
  //   const thumbnailInfo = await ipfs.add(thumbnail.buffer)
  //   const thumbnailHash = thumbnailInfo.path
  //   thumbnailUri = `ipfs://${thumbnailHash}`
  // }

  return await uploadMetadataFile({
    name,
    description,
    tags,
    cid,
    address,
    mimeType,
    displayUri,
    thumbnailUri,
  })
}

export const prepareBulkFiles = async (bulkMints) => {
	
  // const ipfs = create(infuraUrl)
  const ipfs = getClient()

  // upload main file
 // const ipfs = create(infuraUrl)
 
	 // {
	  // mint_pos,
	  // name,
	  // description,
	  // tags,
	  // address,
	  // buffer,
	  // mimeType,
	  // cover,
	  // thumbnail,
	  // generateDisplayUri,
	// }
  let files = [];
  for(const mint of bulkMints){
	files.push(mint.file)
  }
  console.log('files:',files);

  const mainContentCids = await uploadBulkFilesToDirectory(files)
  console.log('got mainContentCids:',mainContentCids);
  let mainContentCidsKeyed = [];
  for (const item of mainContentCids){
	  if(item.Name == '') continue;
	  const pos = item.Name.split('_').shift()
	  mainContentCidsKeyed[pos] = `ipfs://${item.Hash}`
	  console.log('set hash pos:',pos)
  }
  console.log('set mainContentCidsKeyed:',mainContentCidsKeyed);
  
  let metaMediaFiles = [];
  // upload cover image
  for(const mint of bulkMints){
	  console.log('get cover for: ',mint)
	  let displayUri = ''
	  if (mint.generateDisplayUri) {
		// const coverHash = await ipfs.add(new Blob([cover.buffer]))
		const coverFile = buffer2File(mint.cover.buffer,mint.cover.mimeType, 'cover')
		console.log('got cover: ',coverFile)
		metaMediaFiles.push({file:coverFile,mint_pos:mint.mint_pos})
		// displayUri = `ipfs://${coverHash.path}`
	  }
  }
  const metaMediaCids = await uploadBulkFilesToDirectory(metaMediaFiles)
  console.log('got metaMediaCids!:',metaMediaCids)
  let metaMediaCidsKeyed = {cover:[]};
  for (const item of metaMediaCids){
	  if(item.Name == '') continue;
	  const [pos,metaMediaType] = item.Name.split('_')
	  console.log('item ipfs deets:',pos,metaMediaType)
	  metaMediaCidsKeyed[metaMediaType][pos] = `ipfs://${item.Hash}`
  }
  console.log('got metaMediaCidsKeyed!:',metaMediaCidsKeyed)
  
  let metaDataFiles = [];
  for(const mint of bulkMints){
	const buffer = await buildMetadataBuffer({
	  name: mint.title,
	  description: mint.description,
	  tags: mint.tags,
	  cid: mainContentCidsKeyed[mint.mint_pos],
	  address: mint.address,
	  mimeType: mint.mimeType,
	  displayUri : metaMediaCidsKeyed.cover[mint.mint_pos],
	  thumbnailUri : IPFS_DEFAULT_THUMBNAIL_URI,
	  attributes: mint.attributes,
	  additionalCreators: mint?.additionalCreators ?? [],
	})
	const metaDatafile = buffer2File(buffer,"text/plain",'metaData')
	metaDataFiles.push({file:metaDatafile})
  }
  const metaDataCids = await uploadBulkFilesToDirectory(metaDataFiles)
  console.log('got metaDataCids!:',metaDataCids)
  let metaDataCidsKeyed = [];
  for (const item of metaDataCids){
	  if(item.Name == '') continue;
	  const pos = item.Name.split('_').shift()
	  metaDataCidsKeyed[pos] = item.Hash
  }
  
  return metaDataCidsKeyed;
  
  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI

  // await uploadMetadataFile({
    // name,
    // description,
    // tags,
    // cid,
    // address,
    // mimeType,
    // displayUri: cover,
    // thumbnailUri,
  // }) 
  
	// buildMetadataBuffer
  
  // return keyedHashes;
  // */
}

function buffer2File(buffer,type,name){
	return new File([new Blob([buffer])], name, {
		// lastModified: new Date(0), // optional - default = now
		type: type // optional - default = ''
	});
}

export const prepareDirectory = async ({
  name,
  description,
  tags,
  address,
  files,
  cover,
  thumbnail,
  generateDisplayUri,
}) => {
  // upload directory of files
  const hashes = await uploadFilesToDirectory(files)
  const cid = `ipfs://${hashes.directory}`

  // upload cover image
  const ipfs = create(infuraUrl)

  let displayUri = ''
  if (generateDisplayUri) {
    const coverInfo = await ipfs.add(cover.buffer)
    const coverHash = coverInfo.path
    displayUri = `ipfs://${coverHash}`
  } else if (hashes.cover) {
    // TODO: Remove this once generateDisplayUri option is gone
    displayUri = `ipfs://${hashes.cover}`
  }

  // upload thumbnail image
  let thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI

  return await uploadMetadataFile({
    name,
    description,
    tags,
    cid,
    address,
    mimeType: IPFS_DIRECTORY_MIMETYPE,
    displayUri,
    thumbnailUri,
  })
}

function not_directory(file) {
  return file.blob.type !== IPFS_DIRECTORY_MIMETYPE
}
function not_directory2(file) {
  return file.mimeType !== IPFS_DIRECTORY_MIMETYPE
}

async function uploadFilesToDirectory(files) {
  files = files.filter(not_directory)

  const form = new FormData()

  files.forEach((file) => {
    form.append('file', file.blob, encodeURIComponent(file.path))
  })
  const endpoint = `${infuraUrl}/api/v0/add?pin=true&recursive=true&wrap-with-directory=true`
  const res = await axios.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  const data = readJsonLines(res.data)

  // TODO: Remove this once generateDisplayUri option is gone
  // get cover hash
  let cover = null
  const indexFile = files.find((f) => f.path === 'index.html')
  if (indexFile) {
    const indexBuffer = await indexFile.blob.arrayBuffer()
    const coverImagePath = getCoverImagePathFromBuffer(indexBuffer)

    if (coverImagePath) {
      const coverEntry = data.find((f) => f.Name === coverImagePath)
      if (coverEntry) {
        cover = coverEntry.Hash
      }
    }
  }

  const rootDir = data.find((e) => e.Name === '')

  const directory = rootDir.Hash

  return { directory, cover }
}

async function uploadBulkFilesToDirectory(files) {
  files = files.filter(not_directory2)

  const form = new FormData()
	
  // files.forEach((file) => {
  for( const [i,file] of files.entries() ){
	  console.log('try to add file:',file)
	  const _i = file?.mint_pos ?? i;
    form.append('file', file.file, encodeURIComponent(""+i+'_'+file.file.name))
  }
  const endpoint = `${infuraUrl}/api/v0/add?pin=true&recursive=true&wrap-with-directory=true`
  const res = await axios.post(endpoint, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

  const data = readJsonLines(res.data)
  return data;
/* 
  // TODO: Remove this once generateDisplayUri option is gone
  // get cover hash
  let cover = null
  const indexFile = files.find((f) => f.path === 'index.html')
  if (indexFile) {
    const indexBuffer = await indexFile.blob.arrayBuffer()
    const coverImagePath = getCoverImagePathFromBuffer(indexBuffer)

    if (coverImagePath) {
      const coverEntry = data.find((f) => f.Name === coverImagePath)
      if (coverEntry) {
        cover = coverEntry.Hash
      }
    }
  }

  const rootDir = data.find((e) => e.Name === '')

  const directory = rootDir.Hash

  return { directory, cover } */
}

async function buildMetadataBuffer({
  name,
  description,
  tags,
  cid,
  address,
  mimeType,
  displayUri = '',
  thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI,
  attributes = [],
  additionalCreators = [],
}) {
    return Buffer.from(
      JSON.stringify({
        name,
        description,
        tags: tags.replace(/\s/g, '').split(','),
        symbol: 'OBJKT',
        artifactUri: cid,
        displayUri,
        thumbnailUri,
        creators: [...[address],...additionalCreators],
        formats: [{ uri: cid, mimeType }],
        decimals: 0,
        isBooleanAmount: false,
        shouldPreferSymbol: false,
		attributes
      })
    )
}

async function uploadMetadataFile({
  name,
  description,
  tags,
  cid,
  address,
  mimeType,
  displayUri = '',
  thumbnailUri = IPFS_DEFAULT_THUMBNAIL_URI,
}) {
  const ipfs = create(infuraUrl)

  return await ipfs.add(
    Buffer.from(
      JSON.stringify({
        name,
        description,
        tags: tags.replace(/\s/g, '').split(','),
        symbol: 'OBJKT',
        artifactUri: cid,
        displayUri,
        thumbnailUri,
        creators: [address],
        formats: [{ uri: cid, mimeType }],
        decimals: 0,
        isBooleanAmount: false,
        shouldPreferSymbol: false,
      })
    )
  )
}
