import {test,expect} from '@playwright/test';
// Generates test-only WebM bytes in the browser. No user files or API keys are used.
async function videoFixture(page:import('@playwright/test').Page){
  const bytes=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;
    const context=canvas.getContext('2d')!;context.fillStyle='#7752bd';context.fillRect(0,0,160,90);
    const stream=canvas.captureStream(15),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks:Blob[]=[];
    const done=new Promise<Blob>(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:'video/webm'}));});
    recorder.start();const timer=setInterval(()=>{context.fillStyle='#7752bd';context.fillRect(0,0,160,90);context.fillStyle='white';context.fillText('Khmer studio test',15,45);},50);
    await new Promise(resolve=>setTimeout(resolve,1200));clearInterval(timer);recorder.stop();const blob=await done;stream.getTracks().forEach(t=>t.stop());return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page.getByLabel('Choose video',{exact:true}).setInputFiles({name:'fixture.webm',mimeType:'video/webm',buffer:Buffer.from(bytes)});
}
test('initial validation, tabs, mode selection and theme',async({page})=>{
  await page.goto('/');await expect(page.getByRole('button',{name:'✦ Dub to Khmer',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'↻ Load models'}).click();await expect(page.getByRole('status')).toHaveText('Add a Gemini key first.');
  await page.getByRole('button',{name:'Choose processing mode'}).click();await page.getByRole('button',{name:/Translate Only.*Edit subtitles/}).click();await expect(page.getByRole('button',{name:'✎ Translate to Khmer',exact:true})).toBeDisabled();
  await page.getByRole('tab',{name:'Pipeline'}).click();await page.getByLabel('Khmer voice',{exact:true}).selectOption('device');await expect(page.getByText(/Requires an installed Khmer/)).toBeVisible();
  await page.getByRole('tab',{name:'Providers'}).click();await page.getByRole('button',{name:'Show keys'}).click();await expect(page.getByLabel('Gemini key 1')).toHaveAttribute('type','text');
  await page.getByRole('button',{name:'Toggle light or dark theme'}).click();await expect(page.locator('html')).toHaveAttribute('data-theme','light');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`test-results/studio-${test.info().project.name}.png`,fullPage:true});
});
test('real local import, subtitle bypass, editor, invalid timing and SRT download',async({page})=>{
  await page.goto('/');await videoFixture(page);
  // Some browsers initially expose Infinity for live-recorded WebM; seek to resolve it.
  await page.locator('video').evaluate(element=>{const video=element as HTMLVideoElement;if(!Number.isFinite(video.duration))video.currentTime=1e10;});
  await page.getByRole('tab',{name:'Subtitles'}).click();await page.getByLabel('Khmer subtitles or text').fill('សួស្តី!\nអរគុណ។');
  await page.getByRole('button',{name:'Choose processing mode'}).click();await page.getByRole('button',{name:/Translate Only.*Edit subtitles/}).click();
  await expect(page.getByRole('button',{name:'✎ Translate to Khmer',exact:true})).toBeEnabled();await page.getByRole('button',{name:'✎ Translate to Khmer',exact:true}).click();
  await expect(page.getByLabel('Subtitle 1',{exact:true})).toHaveValue('សួស្តី!');await page.getByLabel('Subtitle 1',{exact:true}).fill('ជំរាបសួរ');
  await page.getByLabel('Gender 1',{exact:true}).selectOption('male');
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'↓ SRT',exact:true}).click();expect((await download).suggestedFilename()).toBe('khmer-subtitles.srt');
  await page.getByLabel('End 1',{exact:true}).fill('-1');await page.getByRole('button',{name:'↓ SRT',exact:true}).click();await expect(page.getByRole('status')).toContainText('times must fit');
  await expect(page.getByRole('button',{name:'↓ WAV',exact:true})).toBeDisabled();
});
test('server rejects cross-origin speech requests',async({request})=>{
  const response=await request.post('/api/speech',{headers:{origin:'https://attacker.example'},data:{}});expect(response.status()).toBe(403);
});
