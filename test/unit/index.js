'use strict'

const { expect } = require('chai')
const DockerComposeParser = require('index')

describe('Index', () => {
  describe('#_parseDockerComposeFile', () => {
    let yml

    it('should return fine with version 2', (done) => {
      yml = `
version: '2'
services:
  web:
    build: .
    ports:
      - "7890:7890"
`
      DockerComposeParser._parseDockerComposeFile(yml)
        .asCallback(done)
    })

    it('should return fine with version 2.0', (done) => {
      yml = `
version: '2.0'
services:
  web:
    build: .
    ports:
      - "7890:7890"
`
      DockerComposeParser._parseDockerComposeFile(yml)
        .asCallback(done)
    })

    it('should pass with version 3', (done) => {
      yml = `
version: '3.0'
services:
  web:
    build: .
    ports:
      - "7890:7890"
`
      DockerComposeParser._parseDockerComposeFile(yml)
        .asCallback(done)
    })
    it('should fail with version 2.a', (done) => {
      yml = `
version: '2.a'
services:
  web:
    build: .
    ports:
      - "7890:7890"
`
      DockerComposeParser._parseDockerComposeFile(yml)
        .then(() => { done(new Error('Should have failed')) })
        .catch(() => done())
    })
  })

  describe('#_getMainName', () => {
    let services
    beforeEach(() => {
      services = {
        web: {
          build: 'https://github.com/Runnable/test-compose'
        },
        api: {
          build: 'git@github.com/Runnable/test-compose'
        },
        api2: {
          build: '.'
        },
        database: {
          image: 'asdasdasd'
        },
        web2: {
          build: {
            context: 'asdassad'
          }
        }
      }
    })

    it('should pick api2 as main', done => {
      expect(DockerComposeParser._getMainName(services)).to.equal('api2')
      done()
    })
    it('should pick web2 if api2 isn\'t there', done => {
      delete services.api2
      expect(DockerComposeParser._getMainName(services)).to.equal('web2')
      done()
    })
    it('should pick the first github if api2 and web2 aren\'t there', done => {
      delete services.api2
      delete services.web2
      expect(DockerComposeParser._getMainName(services)).to.equal('web')
      done()
    })
  })

  describe('#populateENVsFromFiles', () => {
    let services
    let envFilesMap
    beforeEach(() => {
      services = [{
        metadata: {
          envFiles: ['./file-that-exists', './file-that-doesnt-exist'],
          links: []
        },
        instance: {
          env: ['WOW=GREAT']
        }
      }]
      envFilesMap = {
        './file-that-exists': 'HELLO=WOW'
      }
    })

    it('should ignore a file if the file was not passed', () => {
      return DockerComposeParser.populateENVsFromFiles(services, envFilesMap)
        .then(services => {
          expect(services).to.have.deep.property('[0].instance.env')
          expect(services[0].instance.env).to.deep.equal([
            'WOW=GREAT',
            'HELLO=WOW'
          ])
        })
    })
  })

  describe('#findExtendedFiles', () => {
    let yml
    it('should return 2 found files', () => {
      yml = `
version: '2'
services:
  web:
    extends:
       file: common.yml
  db:
    image: postgres
  api:
    extends:
       file: base.yml
`
      DockerComposeParser.findExtendedFiles(yml)
      .tap((paths) => {
        expect(paths.length).to.equal(2)
        expect(paths[0]).to.equal('common.yml')
        expect(paths[1]).to.equal('base.yml')
      })
    })

    it('should dedupe files', () => {
      yml = `
version: '2'
services:
  web:
    extends:
       file: common.yml
  db:
    image: postgres
  api:
    extends:
       file: common.yml
`
      DockerComposeParser.findExtendedFiles(yml)
      .tap((paths) => {
        expect(paths.length).to.equal(1)
        expect(paths[0]).to.equal('common.yml')
      })
    })

    it('should return empty array if no extends', () => {
      yml = `
version: '2'
services:
  db:
    image: postgres
  api:
    build: .
`
      DockerComposeParser.findExtendedFiles(yml)
      .tap((paths) => {
        expect(paths.length).to.equal(0)
      })
    })
  })
  describe('#_mergeServices', () => {
    it('should return empty array if empty array was passed', () => {
      const result = DockerComposeParser._mergeServices([])
      expect(result.length).to.equal(0)
    })
    it('should return warning if parent was not found', () => {
      const input = [
        {
          metadata: {
            name: 'api'
          },
          extends: {
            service: 'api-base'
          }
        }
      ]
      const result = DockerComposeParser._mergeServices(input)
      expect(result.length).to.equal(1)
      const warnings = result[0].warnings._warnings
      expect(warnings.length).to.equal(1)
      expect(warnings[0]).to.deep.equal({
        serviceName: 'api',
        parentServiceName: 'api-base',
        message: 'Parent service is not found'
      })
    })
  })
})
