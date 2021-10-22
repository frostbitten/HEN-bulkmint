import React, { useContext, useState } from 'react'
import Compressor from 'compressorjs'
import { BottomBanner } from '../../components/bottom-banner'
import { HicetnuncContext } from '../../context/HicetnuncContext'
import { Page, Container, Padding } from '../../components/layout'
import { Input, Textarea } from '../../components/input'
import { Button, Curate, Primary, Purchase } from '../../components/button'
import { Upload } from '../../components/upload'
import { UploadDir } from '../../components/upload-dir'
import { Preview } from '../../components/preview'
import { prepareFile, prepareFile100MB, prepareDirectory, prepareBulkFiles } from '../../data/ipfs'
import { prepareFilesFromZIP } from '../../utils/html'
import { prepareBatchFilesFromZIP, parseDetailsFromTxt, baseName } from '../../utils/batch'
import {
  ALLOWED_MIMETYPES,
  ALLOWED_FILETYPES_LABEL,
  ALLOWED_COVER_MIMETYPES,
  ALLOWED_COVER_FILETYPES_LABEL,
  MINT_FILESIZE,
  MIMETYPE,
  MAX_EDITIONS,
  MIN_ROYALTIES,
  MAX_ROYALTIES,
} from '../../constants'

const coverOptions = {
  quality: 0.85,
  maxWidth: 1024,
  maxHeight: 1024,
}

const thumbnailOptions = {
  quality: 0.85,
  maxWidth: 350,
  maxHeight: 350,
}

// @crzypathwork change to "true" to activate displayUri and thumbnailUri
const GENERATE_DISPLAY_AND_THUMBNAIL = true

const objktBase = {
	title:'',
	description:'',
	tags:'',
	// amount:1,
	amount:null,
	// royalties:10,
	royalties:null,
	file:null,  // the uploaded file
	cover:null,  // the uploaded or generated cover image
	thumbnail:null, // the uploaded or generated cover image
	needsCover:false,
	attributes:[],
	additionalCreators:[],
}
  
export const BulkMint = () => {
  const { mint, mintMany, getAuth, acc, setAccount, getProxy, setFeedback, syncTaquito } =
    useContext(HicetnuncContext)
  // const history = useHistory()
  
	const [step, setStep] = useState(0)
	const [mintslength, setMintslength] = useState(1)
	const [batchMethod, setBatchMethod] = useState("folder")
	const [mints, setMints] = useState([{...objktBase}]);
	// console.log('mints:',mints)
  
	const updateMintsLength = (newLength) => {
		setMintslength(newLength)
	}
  
	const handleMintsInputChange = (e,i) => {
		console.log(e)
		let { name, value } = e.target;
			console.log('name:',name)
		if(['additionalCreators'].includes(name)){
			console.log('name in arrays list')
			value = value.split(',').map((w)=>{return w.trim()})
		}
		handleMintsChange(i,name,value)
	};
	
	const handleMintsChange = (i,name,value) => {
		setMints(prevMints => {
			let newMints = [ ...prevMints ]
			if(!(i in newMints)){
				newMints[i] = {...objktBase};
			}
			newMints[i][name] = value
			return newMints
		});
	};
	
	const handleMintsChangeMajor = (i,_objkt) => {
		setMints(prevMints => {
			let newMints = [ ...prevMints ]
			if(!(i in newMints)){
				newMints[i] = {...objktBase};
			}
			newMints[i] = { ...newMints[i], ..._objkt};
			// newMints[i] = { ..._objkt};
			// for ( const {key,prop} in _objkt ){
				// handleMintsChange(i,key,prop)
			// }
			return newMints
		});
	};
	
	const setCover = (props,i) => {
		return handleMintsChange(i,'cover',props);
	}
	const setThumbnail = (props,i) => {
		return handleMintsChange(i,'thumbnail',props);
	}
  

  const handleMint = async () => {
    if (!acc) {
      // warning for sync
      setFeedback({
        visible: true,
        message: 'sync your wallet',
        progress: true,
        confirm: false,
      })

      await syncTaquito()

      setFeedback({
        visible: false,
      })
    } else {
		await setAccount()
		// console.log(file.mimeType)
		console.log(ALLOWED_MIMETYPES)
		// check mime type
		mints.forEach((_objkt) => {
			if (ALLOWED_MIMETYPES.indexOf(_objkt.file.mimeType) === -1) {
				// alert(
				//   `File format invalid. supported formats include: ${ALLOWED_FILETYPES_LABEL.toLocaleLowerCase()}`
				// )

				setFeedback({
					visible: true,
					message: `File format invalid. supported formats include: ${ALLOWED_FILETYPES_LABEL.toLocaleLowerCase()}`,
					progress: false,
					confirm: true,
					confirmCallback: () => {
						setFeedback({ visible: false })
					},
				})

				return
			}

			// check file size
			const filesize = (_objkt.file.file.size / 1024 / 1024).toFixed(4)
			if (filesize > MINT_FILESIZE) {
				// alert(
				//   `File too big (${filesize}). Limit is currently set at ${MINT_FILESIZE}MB`
				// )

				setFeedback({
				  visible: true,
				  message: `Max file size (${filesize}). Limit is currently ${MINT_FILESIZE}MB`,
				  progress: false,
				  confirm: true,
				  confirmCallback: () => {
					setFeedback({ visible: false })
				  },
				})

				return
			}

		})

		// file about to be minted, change to the mint screen
		setStep(2)

		setFeedback({
			visible: true,
			message: 'uploading/preparing OBJKT',
			progress: true,
			confirm: false,
		})
	  
		await setTimeout(()=>{},5000)

		// if proxyContract is selected, using it as a the miterAddress:
		const minterAddress = getProxy() || acc.address
		// ztepler: I have not understand the difference between acc.address and getAuth here
		//    so I am using acc.address (minterAddress) in both nftCid.address and in mint call

		let mintData = [];

		// await mints.forEach( async (_objkt) => {
		
		let uploadMany = [];
		
		for (const [i,_objkt] of mints.entries()) {
			if (i >= mintslength)
				break;
			
			const file = _objkt.file;
			// upload file(s)
			await (new Promise(resolve => setTimeout(resolve, 2500)))
			let nftCid
			if (
				[MIMETYPE.ZIP, MIMETYPE.ZIP1, MIMETYPE.ZIP2].includes(file.mimeType)
			) {
				const files = await prepareFilesFromZIP(file.buffer)

				nftCid = await prepareDirectory({
					name: _objkt.title,
					description: _objkt.description,
					tags: _objkt.tags,
					address: minterAddress,
					files,
					cover: _objkt.cover,
					thumbnail: _objkt.thumbnail,
					generateDisplayUri: GENERATE_DISPLAY_AND_THUMBNAIL,
					file: file
				})
				mintData[i] =
					{
						tz: minterAddress, 
						amount: _objkt.amount, 
						cid: nftCid.path, 
						royalties: _objkt.royalties
					}
			} else {
				// process all other files
				// nftCid = await prepareFile({
				uploadMany.push({
					... _objkt,
					... {
						mint_pos: i,
						name: _objkt.title,
						description: _objkt.description,
						tags: _objkt.tags,
						address: minterAddress,
						file: file,
						mimeType: file.mimeType,
						cover: _objkt.cover,
						thumbnail: _objkt.thumbnail,
						generateDisplayUri: GENERATE_DISPLAY_AND_THUMBNAIL,
						additionalCreators: _objkt.additionalCreators,
						attributes: _objkt.attributes,
						
					}
				})
			}

			// await mint(minterAddress, _objkt.amount, nftCid.path, _objkt.royalties)
        }
		if(uploadMany.length){
			let bulkCids = await prepareBulkFiles(uploadMany);
			console.log('bulkCids:',bulkCids)
			for( const _objkt of uploadMany)
			{
				mintData[_objkt.mint_pos] =
					{
						tz: minterAddress, 
						amount: _objkt.amount, 
						cid: bulkCids[_objkt.mint_pos], 
						royalties: _objkt.royalties
					}
			}
		}
				// nftCid = await prepareFile(uploadMany)
		// console.log('mintData:',mintData)
		await mintMany(mintData)
    }
  }

  const handlePreview = () => {
    setStep(1)
  }

  const handleFileUpload = function(i) {
	  const _objktIndex = i;
	  return async (props) => {
		  
		console.log('handleFileUpload',{_objktIndex:_objktIndex},props)
		// setFile(props)
		handleMintsChange(i,'file',props)

		if (GENERATE_DISPLAY_AND_THUMBNAIL) {
		  if (props.mimeType.indexOf('image') === 0) {
			// setNeedsCover(false)
			console.log('cover is NOT needed.')
			handleMintsChange(_objktIndex,'needsCover',false);
			await generateCoverAndThumbnail(props,_objktIndex)
		  } else {
			console.log('cover is needed!')
			// setNeedsCover(true)
			handleMintsChange(_objktIndex,'needsCover',true);
		  }
		}
	  }
  }

	const handleBulkFileUpload = async (items) => {
		
		console.log('handleBulkFileUpload',items)
		
		let itemPaths = {};
		
		//figure out what file goes with what info.
		if(batchMethod == "folder"){
			for( let item of items ){
				let itemPath = item.file.webkitRelativePath.split('/');
				itemPath.pop()
				itemPath = itemPath.join('/')
				itemPaths[itemPath] = (itemPaths?.[itemPath]) ? itemPaths[itemPath] : {}
				if(item.mimeType == "text/plain") {
					itemPaths[itemPath].details = item;
					itemPaths[itemPath].details.raw = await blobToText(item.file)
					itemPaths[itemPath].details.parsed = await parseDetailsFromTxt(itemPaths[itemPath].details.raw)
				}else
					itemPaths[itemPath].media = item;
			}
			
		}else
		if(batchMethod == "name"){
			for( let item of items ){
				let itemPath = item.file.webkitRelativePath.split('/');
				const fileName = itemPath.pop();
				const fileNameBase = baseName(fileName)
				itemPaths[fileNameBase] = itemPaths?.[fileNameBase] ?? {}
				if(item.mimeType == "text/plain") {
					itemPaths[fileNameBase].details = item;
					const _raw = await blobToText(item.file)
					// console.log('raw text data:',_raw)
					itemPaths[fileNameBase].details.raw = _raw
					itemPaths[fileNameBase].details.parsed = await parseDetailsFromTxt(_raw)
				}else
					itemPaths[fileNameBase].media = item;
			}
		}
		// let newMintsLength = 0;
		// setMintslength(0)
		setMintslength(Object.keys(itemPaths).length)
		console.log('itemPaths',itemPaths)
		for (const [i,itemPath] of Object.keys(itemPaths).entries()){
			const _i = i
			const _objktData = itemPaths[itemPath].details?.parsed;
			if(! (_objktData?.title && _objktData?.description && _objktData?.amount ) ){
				console.error('missing objkt data:',itemPath,itemPaths[itemPath])
				throw 'missing objkt data'
			}
			const _objktMedia = itemPaths[itemPath]?.media;
			console.log('bulk import objkt:',_objktData)
			// handleMintsChangeMajor(i, _objkt)
			if(_objktData){
				// setMintslength(++newMintsLength)
				for ( const [key,prop] of Object.entries(_objktData) ){
					handleMintsChange(_i,key,prop)
				}
			}
			if(_objktMedia){
				await (handleFileUpload(i))(itemPaths[itemPath].media)
			}
		}
		// const batchFiles = prepareBatchFilesFromZIP(props.buffer)
	}

  const generateCompressedImage = async (props, options) => {
    const blob = await compressImage(props.file, options)
    const mimeType = blob.type
    const buffer = await blob.arrayBuffer()
    const reader = await blobToDataURL(blob)
    return { mimeType, buffer, reader }
  }

  const compressImage = (file, options) => {
    return new Promise(async (resolve, reject) => {
      new Compressor(file, {
        ...options,
        success(blob) {
          resolve(blob)
        },
        error(err) {
          reject(err)
        },
      })
    })
  }

  const blobToDataURL = async (blob) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.onerror = reject
      reader.onload = (e) => resolve(reader.result)
      reader.readAsDataURL(blob)
    })
  }
  

  const blobToText = async (file) => {
    return new Promise((resolve, reject) => {
      let reader = new FileReader()
      reader.onerror = reject
      reader.onload = (e) => resolve(reader.result)
      // reader.readAsText(file, "UTF-8")
      reader.readAsText(file)
    })
  }

  const handleCoverUploadFn = (i) => {
	 // const handleCoverUpload = 
	 // const _objktIndex = i;
	  return async (props) => {
		console.log('handleCoverUpload')
		await generateCoverAndThumbnail(props,i)
	  }
  }


	const previewData = (_objkt) => {
		if (_objkt){
			let __objkt = {};
			for (const prop of ["title","description","tags","amount", "royalties","needsCover","attributes","additionalCreators"]){
				__objkt[prop] = _objkt[prop]
			}
			__objkt.file = (('file' in _objkt && _objkt.file != null && 'file' in _objkt.file) ? _objkt.file.file.size : null)
				// const __objkt = { 
					// ..._objkt , 
					// ... { "file" : null } //(('file' in _objkt && _objkt.file != null && 'file' in _objkt.file) ? _objkt.file.file.size : null) }
				// }
			return JSON.stringify(__objkt,null,2)
		}
		return '';
	}

  const generateCoverAndThumbnail = async (props,i) => {
    // TMP: skip GIFs to avoid making static
    if (props.mimeType === MIMETYPE.GIF) {
      setCover(props,i)
      setThumbnail(props,i)
      return
    }

    const cover = await generateCompressedImage(props, coverOptions)
    setCover(cover,i)

    const thumb = await generateCompressedImage(props, thumbnailOptions)
    setThumbnail(thumb,i)
  }

  const limitNumericField = async (target, minValue, maxValue) => {
    if (target.value === '') target.value = '' // Seems redundant but actually cleans up e.g. '234e'
    target.value = Math.round(
      Math.max(Math.min(target.value, maxValue), minValue)
    )
  }

  const handleValidation = () => {
	let _invalid = false;
	mints.forEach((_objkt) => {
		if(!_invalid){
			
			const {
				amount,
				royalties,
				file,
				cover,
				thumbnail,
				additionalCreators
			} = _objkt
			  
			if (
			  amount <= 0 ||
			  amount > MAX_EDITIONS ||
			  royalties < MIN_ROYALTIES ||
			  royalties > MAX_ROYALTIES ||
			  !file
			) {
				console.log('invalid reason #1 ')
			  return _invalid = true
			  // return;
			}
			
			if (GENERATE_DISPLAY_AND_THUMBNAIL) {
			  if (cover && thumbnail) {
				// _invalid = false
			  }else{
				console.log('invalid reason #2 ')
				return _invalid = true
			  }
			} else {
			  return _invalid = false
			}
			
			for( const wallet of additionalCreators) {
				console.log('check additionalCreators wallet:',wallet)
				const regexAdditionalCreators = /^\s*tz[a-zA-Z0-9]{34}\s?$/gim
				const walletIsValid = wallet == "" || regexAdditionalCreators.test(wallet);
				if(!walletIsValid){
					console.log('invalid reason: additionalCreators')
					return _invalid = true
				}
			}
			
			// return _invalid = true
			  // return;
		}
	})
	console.log('_invalid check:',_invalid)
	return _invalid
  }
  
  const mintPreviewFn = (e, i) => {
	  if(!mints?.[i]?.file)
		  return;
	  const file = mints[i].file;
	  const title = mints[i].title
	  const description = mints[i].description
	  const tags = mints[i].tags
	  const royalties = mints[i].royalties
	  return (
		<div key={"objkt"+i}>
			  <Preview
                mimeType={file.mimeType}
                previewUri={file.reader}
                title={title}
                description={description}
                tags={tags}
              />
              <p>Your royalties upon each sale are {royalties}%</p>
		</div>
		)
  }
  
  const mintFormFn = (e, i) => {
	  let _objkt = mints[i]
	  return (
		<div key={"objkt"+i}>
          <Container>
            <Padding>
				<h1 style={{ fontSize: '1.5em', margin: '1em 0' }}>Objkt {i+1}</h1>
				
              <Input
                type="text"
                onChange={(e) => handleMintsInputChange(e, i)}
                placeholder="title"
                label="title"
                name="title"
                value={mints?.[i]?.title}
              />

              <Textarea
                type="text"
                name="description"
                style={{ whiteSpace: 'pre' }}
                onChange={(e) => handleMintsInputChange(e, i)}
                placeholder="description (max 5000 characters)"
                label="description"
                value={mints?.[i]?.description}
              />

              <Input
                type="text"
                name="tags"
                onChange={(e) => handleMintsInputChange(e, i)}
                placeholder="tags (comma separated. example: illustration, digital)"
                label="tags"
                value={mints?.[i]?.tags}
              />

              <Input
                type="number"
                min={1}
                max={MAX_EDITIONS}
				name="amount"
                onChange={(e) => handleMintsInputChange(e, i)}
                onBlur={(e) => {
                  limitNumericField(e.target, 1, MAX_EDITIONS)
					handleMintsInputChange(e, i)
                }}
                placeholder={`editions (no. editions, 1-${MAX_EDITIONS})`}
                label="editions"
                value={mints[i] ? mints[i].amount||null : null}
              />

              <Input
                type="number"
				name="royalties"
                min={MIN_ROYALTIES}
                max={MAX_ROYALTIES}
                onChange={(e) => handleMintsInputChange(e, i)}
                onBlur={(e) => {
                  limitNumericField(e.target, MIN_ROYALTIES, MAX_ROYALTIES)
				  handleMintsInputChange(e, i)
                }}
                placeholder={`royalties after each sale (between ${MIN_ROYALTIES}-${MAX_ROYALTIES}%)`}
                label="royalties"
                // value={mints[i] ? mints[i].royalties||null : null}
                value={ mints[i]?.royalties }
              />

              <Input
                type="text"
                name="additionalCreators"
				// disabled
                onChange={(e) => handleMintsInputChange(e, i)}
                placeholder="additional creators (comma separated wallets)"
                label="additional creators"
                value={mints?.[i]?.additionalCreators}
              />
			  <div style={{margin: '-26px 0 26px', fontSize: '0.8em' }} >Has no effect, just provides additional metadata.</div>

			  <label>attributes</label>
			  <div style={{margin: '5px 0', fontSize: '0.8em' }} >Can only be edited from the imported details file.</div>
              <pre style={{border: '1px solid #eee',margin: '0 0 26px'}}>{JSON.stringify( mints?.[i]?.attributes,null,2 )}</pre>

			  

			  {/**/}  
			  <div style={{ margin: '1em 0' }}>
				  <h2 style={{fontWeight: 'bold'}}>mint data preview</h2>
				  <pre>{previewData(mints[i])}</pre>
			  </div>
            </Padding>
          </Container>

          <Container>
            <Padding>
              <Upload
                label={mints[i]?.file?.title ?? "Select OBJKT"}
                allowedTypesLabel={ALLOWED_FILETYPES_LABEL}
                onChange={handleFileUpload(i)}
				name="objktFiles"
				data-i="{i}"
              />
            </Padding>
          </Container>

          {(mints[i] && mints[i].file && mints[i].needsCover) && 
            <Container>
              <Padding>
			  <h1>NEEDS COVER!</h1>
                <Upload
                  label="Select cover image"
                  allowedTypes={ALLOWED_COVER_MIMETYPES}
                  allowedTypesLabel={ALLOWED_COVER_FILETYPES_LABEL}
                  onChange={handleCoverUploadFn(i)}
					name="objktCover"
					data-i="{i}"
                />
              </Padding>
            </Container>
          }
		<hr/>
	    </div>
  )}
	

  let mintForms = Array.apply(null, { length: mintslength }).map(mintFormFn)
  let mintPreviews = Array.apply(null, { length: mintslength }).map(mintPreviewFn)
  

  let pageBody = 
    <Page title="mint" large>
      {step === 0 && (
        <>
          <Container>
            <Padding>
				<h1>Bulk Mint</h1>
			  <div style={{ fontSize: '0.75em', marginTop: '1em' }}>
				✓ GIFs and Images have been tested and are working.<br/>
				⚠ Total size of bulk upload must be below 100Mb<br/>
				⚠ Videos and other formats should proceed with caution.<br/>
				⚠ Bulk minting of HTML Objkts has not been fully implemented and will likely fail when uploading 3 or more.
			  </div>
			  
			  <a style={{ display: 'inline-block', marginTop: '2em' }} href="/bulk-mint-details-example.txt" target="_blank">Download example bulk details file.</a>
			  <div style={{ fontSize: '0.75em', marginTop: '1em' }}>
				  <ul>
					  <li>"Attributes" are in <a href="https://www.w3schools.io/file/yaml-arrays/#yaml-arrays-of-objects" target="_blank">YAML</a> format</li>
					  <li>Tildes, or the "~~~~" marks, are not needed but can be included to make the file easier to read.</li>
					  <li>The description must be the last field</li>
					  <li>Review the mint data before minting. If something is wrong or missing cross reference your file with the example.</li>
				  </ul>
			  </div>
			  
			  <div  style={{ marginTop: '2em' }} >
				  <label>Bulk details/media association by: </label>
				  <select 
						value={batchMethod}
						onChange={(e) => setBatchMethod(e.target.value) }
					>
					<option value="folder">Folder</option>
					<option value="name">Name</option>
				  </select>
				  <div style={{ fontSize: '0.75em', marginTop: '1em' }}>
					  <ul>
						  <li><b>Folder</b><br/>Text files adjacent to media will be parsed as the mint data. folders can have any heirarchy.</li>
						  <li><b>Name</b><br/>Text files and media are all in one folder. Text files have same name as media but with .txt extension.</li>
					  </ul>
				  </div>
			  </div>
			  
				<div style={{ margin: '2em 0' }}>
					<div style={{ fontSize: '0.75em' }}>
						Select the main folder containing all the files/subfolders.
					</div>
					<UploadDir
						label="Mass upload work + info (📁)"
						allowedTypesLabel={ALLOWED_FILETYPES_LABEL}
						onChange={handleBulkFileUpload}
						name="bulkFiles"
					/>
				</div>
			  
				<div style={{ margin: '2em 0' }}>
					<label>Number of Objkts to mint </label>
					<input type="number" min="1" max="100"
					onChange={(e) => updateMintsLength(e.target.value) }
					placeholder="1"
					value={mintslength}
					/>
				</div>
            </Padding>
          </Container>
				
		<hr/>
		{mintForms}

          <Container>
            <Padding>
              <Button onClick={handlePreview} fit disabled={handleValidation()}>
                <Curate>Preview</Curate>
              </Button>
            </Padding>
          </Container>
        </>
      )}
      {step === 1 && (
        <>
          <Container>
            <Padding>
              <div style={{ display: 'flex' }}>
                <Button onClick={() => setStep(0)} fit>
                  <Primary>
                    <strong>back</strong>
                  </Primary>
                </Button>
              </div>
            </Padding>
          </Container>

          <Container>
            <Padding>
              {mintPreviews}
            </Padding>
          </Container>

          <Container>
            <Padding>
              <Button onClick={handleMint} fit>
                <Purchase>mint OBJKT(s)</Purchase>
              </Button>
            </Padding>
          </Container>

          <Container>
            <Padding>
              <p>this operation costs 0.08~ tez</p>
            </Padding>
          </Container>
        </>
      )}
{/*       <BottomBanner>
      Collecting has been temporarily disabled. Follow <a href="https://twitter.com/hicetnunc2000" target="_blank">@hicetnunc2000</a> or <a href="https://discord.gg/jKNy6PynPK" target="_blank">join the discord</a> for updates.
      </BottomBanner> */}
    </Page>
		
  return pageBody
}
