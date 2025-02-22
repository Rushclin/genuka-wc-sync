'use server'
 
export async function create() {
    fetch(
        `${process.env.GENUKA_URL}/${process.env.GENUKA_VERSION}/company/products/jdjddjdjsjd`,
    ).then(re => {
        console.log(re)
    }).catch(err=> console.log(err))
}